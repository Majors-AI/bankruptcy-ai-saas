import { useState, useRef, useEffect } from "react";
import { BookOpen, X, Home, Car, Shield, DollarSign, PiggyBank, Heart, ChevronDown, Package, CreditCard as Edit3, Check, RotateCcw, AlertTriangle, Info, Building } from "lucide-react";
import { StateExemption } from "./exemptions";

function fmt(n: number): string {
  if (!isFinite(n) || n >= 1e12) return "Unlimited";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function parseDollar(s: string): number {
  return parseFloat(s.replace(/[$,]/g, "")) || 0;
}

export interface AssetRow {
  id: string;
  label: string;
  value: number;
  lien: number;
  defaultExemption: number;
  defaultCite: string;
  defaultRule: string;
  category: "real_property" | "vehicle" | "personal" | "retirement" | "bank" | "life" | "wildcard_eligible" | "business";
  isPrimary?: boolean;
  isFullyExempt?: boolean;
  isNonExemptByDefault?: boolean;
}

interface ExemptionQuickViewProps {
  stateEx: StateExemption;
  filingState: string;
  isJointFiling: boolean;
  hasRealProperty: boolean;
  hasVehicles: boolean;
  hasRetirement: boolean;
  hasBankAccounts: boolean;
  assetRows: AssetRow[];
  wildcardTotal: number;
  isTxAggregate: boolean;
}

const RETIREMENT_CITE: Record<string, string> = {
  TX: "Tex. Prop. Code §42.0021", FL: "Fla. Stat. §222.21", CA: "CCP §704.115",
  NY: "CPLR §5205(c)", IL: "735 ILCS 5/12-1006", OH: "O.R.C. §2329.66(A)(10)",
  GA: "O.C.G.A. §44-13-100(a)(2.1)", NC: "N.C.G.S. §1C-1601(a)(9)", VA: "Va. Code §34-34",
  WA: "RCW §6.15.020", CO: "C.R.S. §13-54-102(1)(s)", AZ: "A.R.S. §33-1126(B)",
  NV: "NRS §21.090(1)(r)", MI: "M.C.L.A. §600.5451(1)(n)", MA: "M.G.L. ch. 235 §34A",
  PA: "42 Pa. C.S. §8124(b)", MN: "Minn. Stat. §550.37(24)", OR: "ORS §18.358",
  SC: "S.C. Code §15-41-30(A)(10)", TN: "T.C.A. §26-2-111(1)(D)",
};

function retireCite(s: string): string {
  return RETIREMENT_CITE[s] ?? "11 U.S.C. §522(b)(3)(C) — ERISA-qualified plans; IRAs up to $1,512,350";
}

const VEH_CITE: Record<string, string> = {
  AZ: "A.R.S. §33-1125(8)", CA: "CCP §703.140(b)(2)", FL: "Fla. Stat. §222.25",
  GA: "O.C.G.A. §44-13-100(a)(3)", IL: "735 ILCS 5/12-1001(c)", NY: "CPLR §5205(a)",
  TX: "Tex. Prop. Code §42.002(a)(9)", OH: "O.R.C. §2329.66(A)(2)", NC: "N.C.G.S. §1C-1601(a)(3)",
  VA: "Va. Code §34-26(8)", WA: "RCW §6.15.010(1)(d)(iv)", CO: "C.R.S. §13-54-102(1)(j)",
  NV: "NRS §21.090(1)(f)", MI: "M.C.L.A. §600.5451(2)(b)", MA: "M.G.L. ch. 235 §34(17)",
  PA: "42 Pa. C.S. §8123(a)", MN: "Minn. Stat. §550.37(12a)", OR: "ORS §18.345(1)(c)",
  SC: "S.C. Code §15-41-30(A)(2)", TN: "T.C.A. §26-2-103(a)(2)", FED: "11 U.S.C. §522(d)(2)",
};

const HH_CITE: Record<string, string> = {
  AZ: "A.R.S. §33-1123", CA: "CCP §703.140(b)(3)", FL: "Fla. Stat. §222.061",
  GA: "O.C.G.A. §44-13-100(a)(4)", IL: "735 ILCS 5/12-1001(b)", NY: "CPLR §5205(a)(5)",
  TX: "Tex. Prop. Code §42.002(a)(1)", OH: "O.R.C. §2329.66(A)(3)", NC: "N.C.G.S. §1C-1601(a)(4)",
  WA: "RCW §6.15.010(1)(d)(i)", FED: "11 U.S.C. §522(d)(3)",
};

const JEWELRY_CITE: Record<string, string> = {
  AZ: "A.R.S. §33-1125(1)", CA: "CCP §703.140(b)(4)", GA: "O.C.G.A. §44-13-100(a)(5)",
  IL: "735 ILCS 5/12-1001(b)", NY: "CPLR §5205(a)(6)", WA: "RCW §6.15.010(1)(a)",
  FED: "11 U.S.C. §522(d)(4)",
};

const TOOLS_CITE: Record<string, string> = {
  AZ: "A.R.S. §33-1130", CA: "CCP §703.140(b)(6)", FL: "Fla. Stat. §222.061",
  GA: "O.C.G.A. §44-13-100(a)(7)", IL: "735 ILCS 5/12-1001(d)", NY: "CPLR §5205(a)(7)",
  TX: "Tex. Prop. Code §42.002(a)(7)", OH: "O.R.C. §2329.66(A)(4)", WA: "RCW §6.15.010(1)(e)",
  FED: "11 U.S.C. §522(d)(6)",
};

const WILDCARD_CITE: Record<string, string> = {
  CA: "CCP §703.140(b)(5)", FL: "Fla. Stat. §222.25(4)", GA: "O.C.G.A. §44-13-100(a)(6)",
  IL: "735 ILCS 5/12-1001(b)", NC: "N.C.G.S. §1C-1601(a)(2)", FED: "11 U.S.C. §522(d)(5)",
  DE: "Del. Code tit. 10 §4914", MN: "Minn. Stat. §550.37(24)", NV: "NRS §21.090(1)(z)",
  WA: "RCW §6.15.010(1)(d)(ii)", TX: "Tex. Prop. Code §42.001",
};

export function buildAssetRows(
  stateEx: StateExemption,
  filingState: string,
  isJoint: boolean,
  props: Array<Record<string, unknown>>,
  vehicles: Array<Record<string, unknown>>,
  bankAccounts: Array<Record<string, unknown>>,
  retirementAccounts: Array<Record<string, unknown>>,
  lifePolicies: Array<Record<string, unknown>>,
  annuities: Array<Record<string, unknown>>,
  businessAssets: Array<Record<string, unknown>>,
  personalProps: {
    householdGoods: number; electronics: number; jewelry: number; tools: number;
    stocks: number; stocksDesc?: string; crypto: number; cryptoDesc?: string;
    firearms: number; firearmsCount: number; collectibles: number; collectiblesDesc?: string;
    otherProp: number; otherPropDesc?: string; moneyOwed: number; moneyOwedDesc?: string;
    pendingClaims: number; pendingClaimsDesc?: string;
  },
  rawHomestead: number,
  wildcardTotal: number,
  isTxAggregate: boolean,
): AssetRow[] {
  const s = stateEx.code;
  const rows: AssetRow[] = [];

  const homesteadCite = stateEx.homesteadNote ?? (stateEx.useFederal ? "11 U.S.C. §522(d)(1)" : `${s} homestead statute`);
  const vehCite = isTxAggregate ? "Tex. Prop. Code §42.002(a)(9)" : (VEH_CITE[s] ?? `${s} motor vehicle statute`);
  const txPoolRule = `TX Personal Property Pool — ${isJoint ? "$200,000" : "$100,000"} aggregate · Tex. Prop. Code §42.001–§42.002`;
  const wildcardCite = stateEx.wildcardNote ?? WILDCARD_CITE[s] ?? `${s} wildcard exemption statute`;

  props.forEach((p, i) => {
    const fmv = parseFloat((p.propertyValue as string) ?? "0") || 0;
    const lien = parseFloat((p.loanBalance as string) ?? "0") || 0;
    const equity = fmv - lien;
    const isPrimary = i === 0;
    const exemption = isPrimary && equity > 0 ? Math.min(equity, rawHomestead) : 0;
    const desc = (p.address as string) || (p.propertyType as string) || `Property ${i + 1}`;
    rows.push({
      id: `prop-${i}`,
      label: desc,
      value: fmv,
      lien,
      defaultExemption: exemption,
      defaultCite: isPrimary ? homesteadCite : "No homestead — secondary property",
      defaultRule: isPrimary
        ? (rawHomestead >= 1e12 ? "Unlimited homestead" : `Homestead Exemption — ${fmt(rawHomestead)}`)
        : "No Homestead — Secondary Property",
      category: "real_property",
      isPrimary,
    });
  });

  vehicles.forEach((v, i) => {
    const val = parseFloat((v.value as string) ?? "0") || 0;
    const lien = parseFloat((v.loanBalance as string) ?? "0") || 0;
    const equity = val - lien;
    const exemption = isTxAggregate ? 0 : (equity > 0 ? Math.min(equity, stateEx.vehicle) : 0);
    const label = [v.year, v.make, v.model].filter(Boolean).join(" ") || `Vehicle ${i + 1}`;
    rows.push({
      id: `veh-${i}`,
      label,
      value: val,
      lien,
      defaultExemption: exemption,
      defaultCite: vehCite,
      defaultRule: isTxAggregate ? txPoolRule : `Vehicle Exemption — ${fmt(stateEx.vehicle)} per vehicle`,
      category: "vehicle",
    });
  });

  bankAccounts.forEach((b, i) => {
    const bal = parseFloat((b.balance as string) ?? "0") || 0;
    const bankLabel = `${(b.bankName as string) || "Bank"} — ${(b.accountType as string) || "Account"}`;
    rows.push({
      id: `bank-${i}`,
      label: bankLabel,
      value: bal,
      lien: 0,
      defaultExemption: 0,
      defaultCite: stateEx.bankAccount > 0 ? (stateEx.bankAccountNote ?? `${s} bank account statute`) : wildcardCite,
      defaultRule: stateEx.bankAccount > 0
        ? `Bank Account Exemption — ${fmt(stateEx.bankAccount)}`
        : "Wildcard Eligible — no dedicated bank account exemption",
      category: "wildcard_eligible",
    });
  });

  if (personalProps.householdGoods > 0) {
    const ex = isTxAggregate ? personalProps.householdGoods : Math.min(personalProps.householdGoods, stateEx.householdGoods);
    rows.push({
      id: "hhgoods",
      label: "Household Goods & Furnishings",
      value: personalProps.householdGoods,
      lien: 0,
      defaultExemption: ex,
      defaultCite: isTxAggregate ? "Tex. Prop. Code §42.002(a)(1)" : (HH_CITE[s] ?? `${s} household goods statute`),
      defaultRule: isTxAggregate ? txPoolRule : `Household Goods Exemption — ${fmt(stateEx.householdGoods)}`,
      category: "personal",
    });
  }
  if (personalProps.electronics > 0) {
    const remaining = Math.max(0, stateEx.householdGoods - personalProps.householdGoods);
    const ex = isTxAggregate ? personalProps.electronics : Math.min(personalProps.electronics, remaining);
    rows.push({
      id: "electronics",
      label: "Electronics",
      value: personalProps.electronics,
      lien: 0,
      defaultExemption: ex,
      defaultCite: isTxAggregate ? "Tex. Prop. Code §42.002(a)(1)" : (HH_CITE[s] ?? `${s} household goods statute`),
      defaultRule: isTxAggregate ? txPoolRule : `Household Goods (electronics) — ${fmt(stateEx.householdGoods)} aggregate`,
      category: "personal",
    });
  }
  if (personalProps.jewelry > 0) {
    const ex = isTxAggregate ? personalProps.jewelry : Math.min(personalProps.jewelry, stateEx.jewelry);
    rows.push({
      id: "jewelry",
      label: "Jewelry",
      value: personalProps.jewelry,
      lien: 0,
      defaultExemption: ex,
      defaultCite: isTxAggregate ? "Tex. Prop. Code §42.002(a)(2)" : (JEWELRY_CITE[s] ?? `${s} jewelry statute`),
      defaultRule: isTxAggregate ? txPoolRule : `Jewelry Exemption — ${fmt(stateEx.jewelry)}`,
      category: "personal",
    });
  }
  if (personalProps.tools > 0) {
    const ex = isTxAggregate ? personalProps.tools : Math.min(personalProps.tools, stateEx.tools);
    rows.push({
      id: "tools",
      label: "Tools of the Trade",
      value: personalProps.tools,
      lien: 0,
      defaultExemption: ex,
      defaultCite: isTxAggregate ? "Tex. Prop. Code §42.002(a)(7)" : (TOOLS_CITE[s] ?? `${s} tools statute`),
      defaultRule: isTxAggregate ? txPoolRule : `Tools of the Trade Exemption — ${fmt(stateEx.tools)}`,
      category: "personal",
    });
  }
  if (personalProps.firearms > 0) {
    const ex = isTxAggregate ? personalProps.firearms : 0;
    rows.push({
      id: "firearms",
      label: `Firearms (${personalProps.firearmsCount})`,
      value: personalProps.firearms,
      lien: 0,
      defaultExemption: ex,
      defaultCite: isTxAggregate ? "Tex. Prop. Code §42.002(a)(3)" : wildcardCite,
      defaultRule: isTxAggregate ? txPoolRule : "Wildcard Eligible — no dedicated firearms exemption",
      category: isTxAggregate ? "personal" : "wildcard_eligible",
    });
  }
  if (personalProps.stocks > 0) {
    rows.push({
      id: "stocks",
      label: `Stocks & Brokerage${personalProps.stocksDesc ? ` — ${personalProps.stocksDesc}` : ""}`,
      value: personalProps.stocks,
      lien: 0,
      defaultExemption: 0,
      defaultCite: wildcardCite,
      defaultRule: "Wildcard Eligible — no dedicated stock/brokerage exemption",
      category: "wildcard_eligible",
    });
  }
  if (personalProps.crypto > 0) {
    rows.push({
      id: "crypto",
      label: `Cryptocurrency${personalProps.cryptoDesc ? ` — ${personalProps.cryptoDesc}` : ""}`,
      value: personalProps.crypto,
      lien: 0,
      defaultExemption: 0,
      defaultCite: wildcardCite,
      defaultRule: "Wildcard Eligible — no dedicated cryptocurrency exemption",
      category: "wildcard_eligible",
    });
  }
  if (personalProps.collectibles > 0) {
    rows.push({
      id: "collectibles",
      label: `Collectibles${personalProps.collectiblesDesc ? ` — ${personalProps.collectiblesDesc}` : ""}`,
      value: personalProps.collectibles,
      lien: 0,
      defaultExemption: 0,
      defaultCite: wildcardCite,
      defaultRule: "Wildcard Eligible — no dedicated collectibles exemption",
      category: "wildcard_eligible",
    });
  }
  if (personalProps.otherProp > 0) {
    rows.push({
      id: "otherprop",
      label: `Other Personal Property${personalProps.otherPropDesc ? ` — ${personalProps.otherPropDesc}` : ""}`,
      value: personalProps.otherProp,
      lien: 0,
      defaultExemption: 0,
      defaultCite: wildcardCite,
      defaultRule: "Wildcard Eligible — no dedicated exemption",
      category: "wildcard_eligible",
    });
  }
  if (personalProps.moneyOwed > 0) {
    rows.push({
      id: "moneyowed",
      label: `Money Owed to Debtor${personalProps.moneyOwedDesc ? ` — ${personalProps.moneyOwedDesc}` : ""}`,
      value: personalProps.moneyOwed,
      lien: 0,
      defaultExemption: 0,
      defaultCite: wildcardCite,
      defaultRule: "Wildcard Eligible — no dedicated exemption",
      category: "wildcard_eligible",
    });
  }
  if (personalProps.pendingClaims > 0) {
    rows.push({
      id: "pendingclaims",
      label: `Pending Claims / Lawsuits${personalProps.pendingClaimsDesc ? ` — ${personalProps.pendingClaimsDesc}` : ""}`,
      value: personalProps.pendingClaims,
      lien: 0,
      defaultExemption: 0,
      defaultCite: "Generally non-exempt — consult state PI/personal injury exemptions",
      defaultRule: "Non-Exempt by default — PI proceeds may qualify for state exemption",
      category: "wildcard_eligible",
      isNonExemptByDefault: true,
    });
  }

  retirementAccounts.forEach((r, i) => {
    const bal = parseFloat((r.balance as string) ?? "0") || 0;
    const label = (r.accountType as string) || `Retirement Account ${i + 1}`;
    let cite = retireCite(s);
    let rule = "Retirement — Fully Exempt (ERISA)";
    if (s === "AZ" && (r.accountType as string)?.toLowerCase().includes("ira")) {
      cite = `${cite} | 11 U.S.C. §522(d)(10)(E) — Federal IRA exemption also available`;
      rule = "IRA — AZ may use state or federal IRA exemption (A.R.S. §33-1126(B) or 11 U.S.C. §522(d)(10)(E))";
    }
    rows.push({
      id: `retire-${i}`,
      label,
      value: bal,
      lien: 0,
      defaultExemption: bal,
      defaultCite: cite,
      defaultRule: rule,
      category: "retirement",
      isFullyExempt: true,
    });
  });

  lifePolicies.forEach((p, i) => {
    const cv = parseFloat((p.cashValue as string) ?? "0") || 0;
    if (cv <= 0) return;
    rows.push({
      id: `life-${i}`,
      label: `Life Insurance — Cash Value${(p.insurer as string) ? ` (${p.insurer})` : ""}`,
      value: cv,
      lien: 0,
      defaultExemption: cv,
      defaultCite: (() => {
        const m: Record<string, string> = {
          TX: "Tex. Ins. Code §1108.051", FL: "Fla. Stat. §222.14", CA: "CCP §704.100",
          NY: "N.Y. Ins. Law §3212", IL: "215 ILCS 5/238", OH: "O.R.C. §2329.66(A)(6)",
        };
        return m[s] ?? `${s} life insurance exemption statute`;
      })(),
      defaultRule: "Life Insurance Cash Value — Exempt (dependent beneficiary)",
      category: "life",
      isFullyExempt: true,
    });
  });

  annuities.forEach((a, i) => {
    const val = parseFloat((a.currentValue as string) ?? "0") || 0;
    if (val <= 0) return;
    rows.push({
      id: `annuity-${i}`,
      label: `Annuity${(a.annuityType as string) ? ` — ${a.annuityType}` : ""} ${i + 1}`,
      value: val,
      lien: 0,
      defaultExemption: val,
      defaultCite: `${s} annuity exemption statute`,
      defaultRule: "Annuity — Exempt",
      category: "life",
      isFullyExempt: true,
    });
  });

  businessAssets.forEach((b, i) => {
    const val = parseFloat((b.estimatedValue as string) ?? "0") || 0;
    const owed = parseFloat((b.owedOnIt as string) ?? "0") || 0;
    const desc = (b.description as string) || (b.assetType as string) || `Business Asset ${i + 1}`;
    rows.push({
      id: `biz-${i}`,
      label: desc,
      value: val,
      lien: owed,
      defaultExemption: 0,
      defaultCite: "Generally non-exempt — no standard business asset exemption",
      defaultRule: "Business Asset — Non-Exempt (no applicable exemption)",
      category: "business",
      isNonExemptByDefault: true,
    });
  });

  return rows;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  real_property: <Home size={10} />,
  vehicle: <Car size={10} />,
  personal: <Package size={10} />,
  retirement: <PiggyBank size={10} />,
  bank: <DollarSign size={10} />,
  life: <Heart size={10} />,
  wildcard_eligible: <Shield size={10} />,
  business: <Building size={10} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  real_property: "text-amber-400",
  vehicle: "text-blue-400",
  personal: "text-emerald-400",
  retirement: "text-violet-400",
  bank: "text-sky-400",
  life: "text-rose-400",
  wildcard_eligible: "text-slate-400",
  business: "text-orange-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  real_property: "Real Property",
  vehicle: "Motor Vehicles",
  personal: "Personal Property",
  retirement: "Retirement & Annuities",
  bank: "Bank Accounts",
  life: "Life Insurance",
  wildcard_eligible: "Wildcard / No Dedicated Exemption",
  business: "Business Assets",
};

interface OverrideState {
  [id: string]: {
    amount: string;
    cite: string;
    editing: boolean;
  };
}

interface WildcardAlloc {
  [id: string]: string;
}

export default function ExemptionQuickView({
  stateEx,
  filingState,
  isJointFiling,
  assetRows,
  wildcardTotal,
  isTxAggregate,
}: ExemptionQuickViewProps) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<OverrideState>({});
  const [wildcardAlloc, setWildcardAlloc] = useState<WildcardAlloc>({});
  const [wildcardMode, setWildcardMode] = useState<"auto" | "manual">("auto");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (wildcardMode === "auto") {
      const newAlloc: WildcardAlloc = {};
      let remaining = wildcardTotal;
      for (const row of assetRows) {
        if (row.category === "wildcard_eligible" && !row.isNonExemptByDefault && remaining > 0) {
          const equity = Math.max(0, row.value - row.lien);
          const currentFixed = getFixedExemption(row.id);
          const available = Math.max(0, equity - currentFixed);
          const applied = Math.min(remaining, available);
          if (applied > 0) {
            newAlloc[row.id] = String(applied);
            remaining -= applied;
          }
        }
      }
      setWildcardAlloc(newAlloc);
    }
  }, [wildcardMode, wildcardTotal, assetRows, overrides]);

  function getFixedExemption(id: string): number {
    const ov = overrides[id];
    if (ov) return parseDollar(ov.amount);
    const row = assetRows.find(r => r.id === id);
    return row?.defaultExemption ?? 0;
  }

  function getWildcardForRow(id: string): number {
    return parseDollar(wildcardAlloc[id] ?? "0");
  }

  function getTotalExemption(row: AssetRow): number {
    return getFixedExemption(row.id) + getWildcardForRow(row.id);
  }

  function getCite(row: AssetRow): string {
    const wc = getWildcardForRow(row.id);
    const ov = overrides[row.id];
    const wcCite = stateEx.wildcardNote ?? WILDCARD_CITE[stateEx.code] ?? `${stateEx.code} wildcard statute`;
    const baseCite = ov?.cite ?? row.defaultCite;
    if (wc > 0 && getFixedExemption(row.id) > 0) return `${baseCite} + ${wcCite}`;
    if (wc > 0) return wcCite;
    return baseCite;
  }

  function getRule(row: AssetRow): string {
    const ov = overrides[row.id];
    const wc = getWildcardForRow(row.id);
    const base = ov ? `OVERRIDE: ${ov.amount}` : row.defaultRule;
    if (wc > 0) return `${base} + Wildcard ${fmt(wc)}`;
    return base;
  }

  const wildcardEligibleIds = assetRows
    .filter(r => r.category === "wildcard_eligible" && !r.isNonExemptByDefault)
    .map(r => r.id);

  const totalWildcardUsed = wildcardEligibleIds.reduce((a, id) => a + parseDollar(wildcardAlloc[id] ?? "0"), 0);
  const wildcardRemaining = wildcardTotal - totalWildcardUsed;

  function startEdit(id: string) {
    const row = assetRows.find(r => r.id === id)!;
    setOverrides(prev => ({
      ...prev,
      [id]: {
        amount: String(getFixedExemption(id)),
        cite: prev[id]?.cite ?? row.defaultCite,
        editing: true,
      },
    }));
  }

  function commitEdit(id: string) {
    setOverrides(prev => ({
      ...prev,
      [id]: { ...prev[id], editing: false },
    }));
  }

  function resetOverride(id: string) {
    setOverrides(prev => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  function updateWildcardAlloc(id: string, val: string) {
    setWildcardAlloc(prev => ({ ...prev, [id]: val }));
    setWildcardMode("manual");
  }

  const grouped: Record<string, AssetRow[]> = {};
  const catOrder = ["real_property", "vehicle", "personal", "retirement", "bank", "wildcard_eligible", "life", "business"];
  for (const row of assetRows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  const presentCategories = catOrder.filter(c => grouped[c]?.length);

  const totalAssetValue = assetRows.reduce((a, r) => a + r.value, 0);
  const totalExemptionApplied = assetRows.reduce((a, r) => a + getTotalExemption(r), 0);
  const totalNonExempt = assetRows.reduce((a, r) => {
    const eq = Math.max(0, r.value - r.lien);
    return a + Math.max(0, eq - getTotalExemption(r));
  }, 0);

  const hasOverrides = Object.keys(overrides).some(id => !overrides[id].editing) || wildcardMode === "manual";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-400/50 text-blue-300 hover:text-blue-200 rounded-lg px-2.5 py-1.5 transition-all duration-150"
      >
        <BookOpen size={10} />
        <span>View Exemptions</span>
        {hasOverrides && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
        <ChevronDown size={9} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[820px] max-h-[82vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60">
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700/60 px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-white">{stateEx.state} — Exemption Schedule</p>
                {stateEx.useFederal && <span className="text-[9px] bg-blue-500/15 border border-blue-400/30 text-blue-300 rounded px-1.5 py-0.5">Federal System</span>}
                {stateEx.federalOption && <span className="text-[9px] bg-amber-500/15 border border-amber-400/30 text-amber-300 rounded px-1.5 py-0.5">Fed. Option Available</span>}
                {isTxAggregate && <span className="text-[9px] bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 rounded px-1.5 py-0.5">TX Aggregate Pool</span>}
                {hasOverrides && <span className="text-[9px] bg-amber-500/15 border border-amber-400/30 text-amber-300 rounded px-1.5 py-0.5">Attorney Overrides Active</span>}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isJointFiling ? "Joint Filing" : "Individual Filing"}
                {wildcardTotal > 0 && ` · Wildcard: ${fmt(wildcardTotal)} available, ${fmt(wildcardRemaining)} remaining`}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={13} />
            </button>
          </div>

          {/* Wildcard banner */}
          {wildcardTotal > 0 && (
            <div className="mx-4 mt-3 px-3 py-2.5 bg-slate-800/50 border border-slate-600/40 rounded-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Shield size={11} className="text-slate-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-white">Wildcard Exemption — {fmt(wildcardTotal)} available</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {stateEx.wildcardNote ?? WILDCARD_CITE[stateEx.code] ?? `${stateEx.code} wildcard statute`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[11px] font-bold ${wildcardRemaining < 0 ? "text-red-400" : wildcardRemaining > 0 ? "text-amber-300" : "text-green-400"}`}>
                    {wildcardRemaining < 0 ? `Overallocated by ${fmt(Math.abs(wildcardRemaining))}` : wildcardRemaining > 0 ? `${fmt(wildcardRemaining)} unallocated` : "Fully allocated"}
                  </span>
                  <button
                    onClick={() => setWildcardMode("auto")}
                    className={`text-[9px] px-2 py-1 rounded border transition-colors ${wildcardMode === "auto" ? "bg-blue-500/20 border-blue-400/40 text-blue-300" : "bg-slate-700/50 border-slate-600/40 text-slate-400 hover:text-slate-300"}`}
                  >
                    Auto-spread
                  </button>
                  <button
                    onClick={() => setWildcardMode("manual")}
                    className={`text-[9px] px-2 py-1 rounded border transition-colors ${wildcardMode === "manual" ? "bg-amber-500/20 border-amber-400/40 text-amber-300" : "bg-slate-700/50 border-slate-600/40 text-slate-400 hover:text-slate-300"}`}
                  >
                    Manual
                  </button>
                </div>
              </div>
              {wildcardRemaining < 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-300">
                  <AlertTriangle size={9} />
                  <span>Total wildcard allocation exceeds available amount — please reduce allocations</span>
                </div>
              )}
            </div>
          )}

          {/* Asset table per category */}
          <div className="px-4 py-3 space-y-4">
            {presentCategories.map(cat => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={CATEGORY_COLORS[cat]}>{CATEGORY_ICONS[cat]}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{CATEGORY_LABELS[cat]}</span>
                  <div className="h-px flex-1 bg-slate-700/40" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/40">
                        <th className="text-left py-1.5 px-2 text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Asset</th>
                        <th className="text-right py-1.5 px-2 text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Value</th>
                        <th className="text-right py-1.5 px-2 text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Equity</th>
                        <th className="text-right py-1.5 px-2 text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Exemption</th>
                        <th className="text-left py-1.5 px-2 text-[9px] text-slate-500 uppercase tracking-widest font-semibold w-56">Exemption Rule</th>
                        <th className="text-right py-1.5 px-2 text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Non-Exempt</th>
                        <th className="py-1.5 px-2 text-[9px] text-slate-500 uppercase tracking-widest font-semibold text-center w-8">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[cat].map(row => {
                        const equity = Math.max(0, row.value - row.lien);
                        const totalEx = getTotalExemption(row);
                        const nonExempt = Math.max(0, equity - totalEx);
                        const ov = overrides[row.id];
                        const hasOverride = ov && !ov.editing;
                        const wcAmt = getWildcardForRow(row.id);
                        const fixedEx = getFixedExemption(row.id);
                        const isWcEligible = row.category === "wildcard_eligible" && !row.isNonExemptByDefault;

                        return (
                          <tr key={row.id} className="border-b border-slate-700/20 hover:bg-slate-800/25 group">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1.5">
                                <span className={`flex-shrink-0 ${CATEGORY_COLORS[row.category]}`}>{CATEGORY_ICONS[row.category]}</span>
                                <span className="text-[11px] text-slate-300 leading-tight">
                                  {row.label}
                                  {row.isPrimary && <span className="ml-1 text-[8px] text-blue-400 border border-blue-400/30 rounded px-1 py-0.5">Primary</span>}
                                  {row.isFullyExempt && <span className="ml-1 text-[8px] text-violet-300 border border-violet-400/30 rounded px-1 py-0.5">Fully Exempt</span>}
                                  {hasOverride && <span className="ml-1 text-[8px] text-amber-400 border border-amber-400/30 rounded px-1 py-0.5">Override</span>}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right text-[11px] text-white font-semibold">{row.value > 0 ? fmt(row.value) : "—"}</td>
                            <td className="py-2 px-2 text-right text-[11px] text-blue-300">{equity > 0 ? fmt(equity) : row.lien > row.value ? <span className="text-slate-500">Underwater</span> : "—"}</td>

                            {/* Exemption amount — editable */}
                            <td className="py-2 px-2 text-right">
                              {ov?.editing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="text"
                                    value={ov.amount}
                                    onChange={e => setOverrides(prev => ({ ...prev, [row.id]: { ...prev[row.id], amount: e.target.value } }))}
                                    className="w-20 text-right text-[11px] bg-slate-700 border border-blue-400/50 rounded px-1.5 py-0.5 text-white focus:outline-none"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === "Enter") commitEdit(row.id); if (e.key === "Escape") resetOverride(row.id); }}
                                  />
                                  <button onClick={() => commitEdit(row.id)} className="text-green-400 hover:text-green-300">
                                    <Check size={9} />
                                  </button>
                                  <button onClick={() => resetOverride(row.id)} className="text-slate-500 hover:text-red-400">
                                    <X size={9} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className={`text-[11px] font-bold ${totalEx > 0 ? "text-green-400" : row.isNonExemptByDefault ? "text-red-400" : "text-slate-500"}`}>
                                    {totalEx > 0 ? fmt(totalEx) : "—"}
                                  </span>
                                  {wcAmt > 0 && fixedEx > 0 && (
                                    <span className="text-[9px] text-slate-400">{fmt(fixedEx)} + WC {fmt(wcAmt)}</span>
                                  )}
                                  {wcAmt > 0 && fixedEx === 0 && (
                                    <span className="text-[9px] text-slate-400">WC only: {fmt(wcAmt)}</span>
                                  )}
                                </div>
                              )}
                              {/* Wildcard sub-input for eligible rows in manual mode */}
                              {wildcardTotal > 0 && isWcEligible && wildcardMode === "manual" && !ov?.editing && (
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <span className="text-[8px] text-slate-500">+WC:</span>
                                  <input
                                    type="text"
                                    value={wildcardAlloc[row.id] ?? "0"}
                                    onChange={e => updateWildcardAlloc(row.id, e.target.value)}
                                    className="w-16 text-right text-[10px] bg-slate-700/50 border border-slate-600/50 rounded px-1 py-0.5 text-slate-300 focus:outline-none focus:border-amber-400/50"
                                  />
                                </div>
                              )}
                            </td>

                            {/* Exemption Rule + Citation */}
                            <td className="py-2 px-2">
                              {ov?.editing ? (
                                <input
                                  type="text"
                                  value={ov.cite}
                                  placeholder="Statute citation..."
                                  onChange={e => setOverrides(prev => ({ ...prev, [row.id]: { ...prev[row.id], cite: e.target.value } }))}
                                  className="w-full text-[10px] bg-slate-700 border border-blue-400/50 rounded px-1.5 py-0.5 text-white focus:outline-none"
                                />
                              ) : (
                                <div className="min-w-0">
                                  <p className="text-[9px] text-slate-300 leading-tight font-medium truncate" title={getRule(row)}>{getRule(row)}</p>
                                  <p className="text-[9px] font-mono text-blue-300/70 mt-0.5 truncate" title={getCite(row)}>{getCite(row)}</p>
                                </div>
                              )}
                            </td>

                            {/* Non-Exempt */}
                            <td className="py-2 px-2 text-right">
                              {row.isNonExemptByDefault && totalEx === 0 ? (
                                <span className="text-[9px] font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded px-1.5 py-0.5">NON-EXEMPT</span>
                              ) : equity <= 0 ? (
                                <span className="text-[11px] text-slate-500">—</span>
                              ) : nonExempt > 0 ? (
                                <span className="text-[11px] font-bold text-red-400">{fmt(nonExempt)}</span>
                              ) : (
                                <span className="flex items-center justify-end gap-1 text-[11px] font-bold text-green-400">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  Exempt
                                </span>
                              )}
                            </td>

                            {/* Edit button */}
                            <td className="py-2 px-2 text-center">
                              {!row.isFullyExempt && !ov?.editing && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => startEdit(row.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-blue-400"
                                    title="Override exemption amount & citation"
                                  >
                                    <Edit3 size={9} />
                                  </button>
                                  {hasOverride && (
                                    <button
                                      onClick={() => resetOverride(row.id)}
                                      className="text-amber-500 hover:text-amber-300"
                                      title="Reset to calculated default"
                                    >
                                      <RotateCcw size={9} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Summary footer */}
          <div className="sticky bottom-0 bg-slate-900/98 border-t border-slate-700/60 px-4 py-3 rounded-b-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Total Assets</p>
                  <p className="text-sm font-bold text-white">{fmt(totalAssetValue)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Total Exempted</p>
                  <p className="text-sm font-bold text-green-400">{fmt(totalExemptionApplied)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Total Non-Exempt</p>
                  <p className={`text-sm font-bold ${totalNonExempt > 0 ? "text-red-400" : "text-green-400"}`}>{totalNonExempt > 0 ? fmt(totalNonExempt) : "$0 — Fully Exempt"}</p>
                </div>
                {wildcardTotal > 0 && (
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Wildcard Remaining</p>
                    <p className={`text-sm font-bold ${wildcardRemaining < 0 ? "text-red-400" : wildcardRemaining > 0 ? "text-amber-300" : "text-slate-400"}`}>{fmt(Math.abs(wildcardRemaining))}{wildcardRemaining < 0 ? " over" : ""}</p>
                  </div>
                )}
              </div>
              {hasOverrides && (
                <button
                  onClick={() => { setOverrides({}); setWildcardMode("auto"); }}
                  className="flex items-center gap-1.5 text-[10px] text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-300/50 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <RotateCcw size={9} />
                  Reset All Overrides
                </button>
              )}
            </div>
            <div className="flex items-start gap-1.5">
              <Info size={9} className="text-slate-600 flex-shrink-0 mt-0.5" />
              <p className="text-[9px] text-slate-600 leading-relaxed">
                Hover any row and click the edit icon to override exemption amounts and citations. Wildcard can be auto-spread across eligible assets or manually allocated per asset. Retirement, life insurance, and annuities are shown as fully exempt per applicable statute. All amounts are for attorney reference only — verify against current statute.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
