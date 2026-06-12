// Ch.13 Eligibility / Summary — the Ch.13 Signing Review's first tab.
//
// First non-test consumer of the cramdown engine. Pipeline per the spec:
//   bifurcate (§ 506(a) + hanging-paragraph)
//     → computeTillRate (WSJ prime + Till premium, attorney-editable)
//       → amortizeMonthly (level-payment on the crammed-down secured portion)
//         → computeCh13PlanCost (conduit, trustee fee, monthly plan payment)
//
// READ-ONLY display — engine computes live. Inputs that aren't plumbed
// through the existing intake/case schema yet are TODO-stubbed with a
// labeled sample value so the math still computes; the report flags
// which inputs are stubbed vs wired.

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, Calculator, ShieldCheck, Car, Home, DollarSign,
  Info, RefreshCcw,
} from "lucide-react";
import { bifurcate, type BifurcationResult } from "../../lib/ch13Cramdown";
import { computeTillRate, amortizeMonthly } from "../../lib/tillRate";
import { computeCh13PlanCost, type CH13Venue } from "../../lib/ch13PlanCost";
import { classifyCommitmentPeriod } from "../../lib/ch13Commitment";
import {
  isMedianAvailable,
  type Ch13SecuredClaimInput as Ch13SecuredClaimInputLib,
} from "../../lib/ch13Derive";

// Re-export the pure-lib type as a Ch13Eligibility-scoped alias so existing
// imports (`import { Ch13SecuredClaimInput } from "./Ch13Eligibility"`)
// keep compiling unchanged.
export type Ch13SecuredClaimInput = Ch13SecuredClaimInputLib;

// Ch13SecuredClaimInput lives in src/lib/ch13Derive.ts now (pure data
// shape, no React). Re-exported above as the same name for unchanged
// downstream imports.

export interface Ch13EligibilityProps {
  /** True when the viewer is a lawyer — gates the D→unsecured
   *  reclassification controls (per spec, non-lawyers can't see them). */
  isLawyer: boolean;
  /** Secured-claim inputs from the case. Today these are TODO-stubbed at
   *  the parent (Ch13SigningReview) until claim-record plumbing lands. */
  securedClaims: ReadonlyArray<Ch13SecuredClaimInput>;
  /** CMI ($/month) — from cmi.ts upstream. */
  cmiMonthly: number;
  /** State median annual income for the debtor's household — drives
   *  commitment period via classifyCommitmentPeriod. `null` when the
   *  filing state isn't in MEDIAN_INCOME_BY_STATE (rather than defaulting
   *  to 0, which would mis-classify any positive CMI as above-median
   *  → debtor-adverse 60-month commitment). The UI then surfaces a
   *  "median unavailable" notice instead of computing a wrong number. */
  medianAnnual: number | null;
  /** Filing state — used in the "median unavailable" message when
   *  medianAnnual is null. */
  filingState?: string;
  /** Plan term (months) — typically from classifyCommitmentPeriod result. */
  planMonths: number;
  /** Mortgage arrears in plan flag — drives conduit. */
  mortgageArrearsInPlan: boolean;
  /** Ongoing post-petition mortgage over the plan term (only enters the
   *  fee base when conduit is on). */
  ongoingMortgageOverTerm: number;
  /** Mortgage arrears cure total (one-time). */
  arrearsCure: number;
  /** Priority unsecured claims paid through the plan. */
  priorityClaims: number;
  /** Filing venue — drives the trustee-fee multiplier. */
  venue: CH13Venue;
  /** § 1325(a)(4) best-interests floor — the Ch.7 liquidation total.
   *  Supplied by the parent (lifted from ExemptionsLiquidationPanel's
   *  onTotalsChange callback). null when not yet computed. */
  bestInterestsFloor: number | null;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function Ch13Eligibility(props: Ch13EligibilityProps) {
  // Till rate is editable per case — WSJ prime + risk premium (attorneys
  // can override). Defaults: WSJ prime 8.5 (TODO: wire to a published
  // source), premium 2.0 (Till plurality default).
  const [wsjPrime, setWsjPrime] = useState<number>(8.5);
  const [riskPremium, setRiskPremium] = useState<number>(2.0);
  const [rateOverride, setRateOverride] = useState<string>("");

  // Per-claim attorney reclassification flags. Keyed by claim id.
  const [reclassified, setReclassified] = useState<Record<string, boolean>>({});
  // Per-claim FMV overrides (UI-only; engine consumes via fmvOverride).
  const [fmvOverrides, setFmvOverrides] = useState<Record<string, string>>({});
  // Conduit toggle is plumbed through to the engine via prop, but we
  // mirror it locally so the UI can simulate "what if" without changing
  // the parent.
  const [conduitOverride, setConduitOverride] = useState<boolean | null>(null);
  const conduitOn = conduitOverride ?? props.mortgageArrearsInPlan;

  // ─── Pipeline ───────────────────────────────────────────────────────

  const tillResult = useMemo(() => {
    const override = rateOverride.trim() === "" ? null : parseFloat(rateOverride);
    return computeTillRate({
      wsjPrime,
      riskPremium,
      rateOverride: override != null && Number.isFinite(override) ? override : null,
    });
  }, [wsjPrime, riskPremium, rateOverride]);

  // Split anti-mod claims (principal-residence mortgages — § 1322(b)(2))
  // from the cramdown set. Anti-mod claims don't pass through the §506
  // bifurcation; they ride through as cure-and-maintain (handled by the
  // existing ongoingMortgageOverTerm + arrearsCure flows on the parent).
  const antiModClaims = useMemo(
    () => props.securedClaims.filter(c => c.antiModification === true),
    [props.securedClaims],
  );

  const bifurcations = useMemo(() => {
    return props.securedClaims
      .filter(c => c.antiModification !== true)
      .map(c => {
        const fmvRaw = fmvOverrides[c.id];
        const fmvOverride = fmvRaw && fmvRaw.trim() !== "" ? parseFloat(fmvRaw) : c.fmvOverride;
        const r = bifurcate({
          claimAmount: c.claimAmount,
          kbbPrivateParty: c.kbbPrivateParty,
          fmvOverride: fmvOverride ?? null,
          reclassifiedUnsecured: reclassified[c.id] === true,
          hangingParagraph: {
            isMotorVehicle: c.isMotorVehicle,
            isPersonalUseVehicle: c.isPersonalUseVehicle,
            daysSincePurchase: c.daysSincePurchase,
            isOtherPurchaseMoney: c.isOtherPurchaseMoney,
            isRetained: c.isRetained,
          },
        });
        return { claim: c, result: r };
      });
  }, [props.securedClaims, reclassified, fmvOverrides]);

  // Sum of secured monthly payments × planMonths = total secured
  // cramdown payments through the plan. Each non-anti-mod claim
  // amortizes its own secured portion at the Till rate.
  const securedMonthlyTotal = useMemo(() => {
    return bifurcations.reduce(
      (acc, b) => acc + amortizeMonthly(b.result.securedValue, tillResult.annualRatePct, props.planMonths),
      0,
    );
  }, [bifurcations, tillResult.annualRatePct, props.planMonths]);

  const securedCramdownPayments = securedMonthlyTotal * props.planMonths;

  // Unsecured distribution: take the best-interests floor (Ch.7
  // liquidation total) as a placeholder for the plan-mandated minimum
  // dividend. Real spec: plan must pay general unsecured at least the
  // best-interests floor (§ 1325(a)(4)) — present-value discount aside.
  // Plus any § 506(a) deficiencies from bifurcation also go into the
  // unsecured pool, but those flow through claim-management not the
  // disbursement-base directly here. For now: the floor is the dividend.
  const unsecuredDistribution = props.bestInterestsFloor ?? 0;

  const planCost = useMemo(() => {
    return computeCh13PlanCost({
      unsecuredDistribution,
      securedCramdownPayments,
      arrearsCure: props.arrearsCure,
      priorityClaims: props.priorityClaims,
      mortgageArrearsInPlan: conduitOn,
      ongoingMortgageOverTerm: props.ongoingMortgageOverTerm,
      planMonths: props.planMonths,
      venue: props.venue,
    });
  }, [
    unsecuredDistribution, securedCramdownPayments, props.arrearsCure,
    props.priorityClaims, conduitOn, props.ongoingMortgageOverTerm,
    props.planMonths, props.venue,
  ]);

  // When medianAnnual is null (state not in MEDIAN_INCOME_BY_STATE) we
  // CANNOT classify the commitment period — show an "unavailable" notice
  // rather than computing against a zero fallback (which would treat
  // every positive CMI as above-median = 60 months, the debtor-adverse
  // direction). The pure gate lives in src/lib/ch13Derive.ts so it's
  // unit-testable independently.
  const medianAvailable = isMedianAvailable(props.medianAnnual);
  const commitment = useMemo(() => {
    if (!medianAvailable || props.medianAnnual == null) return null;
    return classifyCommitmentPeriod({
      cmiMonthly: props.cmiMonthly,
      medianAnnual: props.medianAnnual,
    });
  }, [props.cmiMonthly, props.medianAnnual, medianAvailable]);

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Section title="Commitment Period" icon={<ShieldCheck className="w-4 h-4 text-sky-400" />}>
        {commitment == null ? (
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200 leading-relaxed">
              Median income unavailable for <strong className="text-amber-300">{props.filingState || "the filing state"}</strong> —
              commitment period not classified. § 1325(b)(4) requires the state median for the
              debtor's household size to determine whether the plan must run 5 years
              (at/above median) or may run 3 years (below median). Load the state's median
              into MEDIAN_INCOME_BY_STATE (see <code>src/lib/irsMeansStandards.ts</code>) and the
              classification fires automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <Stat label="CMI (annualized)" value={fmt(commitment.cmiAnnual)} />
              <Stat label="State median" value={fmt(commitment.medianAnnual)} />
              <Stat
                label="Applicable period"
                value={`${commitment.period.months} months`}
                tone={commitment.aboveMedian ? "amber" : "emerald"}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              {commitment.period.description}
            </p>
          </>
        )}
      </Section>

      {/* Principal-residence mortgage(s) — § 1322(b)(2) anti-modification.
          Rendered SEPARATELY from the cramdown set per Nobelman (508 U.S.
          324). Treatment is cure-and-maintain under § 1322(b)(5); no §506
          bifurcation, no FMV override, no D→unsecured. */}
      {antiModClaims.length > 0 && (
        <Section title="Principal Residence — § 1322(b)(2) Anti-Modification" icon={<Home className="w-4 h-4 text-sky-400" />}>
          <div className="space-y-2">
            {antiModClaims.map(claim => (
              <AntiModificationCard key={claim.id} claim={claim} />
            ))}
            <p className="text-[10px] text-slate-500 italic leading-snug">
              <Info className="w-3 h-3 inline mr-1" />
              Per <em>Nobelman v. American Sav. Bank</em>, 508 U.S. 324 (1993), a security interest
              in real property that is the debtor's principal residence cannot be modified — even
              when undersecured. Treatment is cure-and-maintain under § 1322(b)(5).
              {" "}
              <strong className="text-amber-300">Wholly unsecured junior liens</strong> on the
              principal residence (where senior balances ≥ collateral value, leaving $0 securing
              the junior) MAY be strip-eligible (jurisdiction-dependent; see <em>In re Tanner</em> /
              <em>In re Lane</em>). That is a separate attorney-confirmed determination — not
              auto-detected. Junior-lien capture in intake is a follow-up.
            </p>
          </div>
        </Section>
      )}

      <Section title="Secured-Claim Bifurcation (§ 506(a))" icon={<Car className="w-4 h-4 text-sky-400" />}>
        {bifurcations.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            {antiModClaims.length > 0
              ? "No bifurcatable secured claims — the principal-residence mortgage above is anti-modification."
              : "No secured claims plumbed yet — TODO wire from case secured-debt schedule."}
          </p>
        ) : (
          <div className="space-y-2">
            {bifurcations.map(({ claim, result }) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                result={result}
                fmvOverrideValue={fmvOverrides[claim.id] ?? ""}
                onFmvChange={v => setFmvOverrides(prev => ({ ...prev, [claim.id]: v }))}
                reclassified={reclassified[claim.id] === true}
                onReclassify={next => setReclassified(prev => ({ ...prev, [claim.id]: next }))}
                isLawyer={props.isLawyer}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Till Rate (§ 1325(a)(5)(B)(ii))" icon={<Calculator className="w-4 h-4 text-sky-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <NumInput label="WSJ Prime %" value={wsjPrime} step={0.25} onChange={setWsjPrime} />
          <NumInput label="Risk premium %" value={riskPremium} step={0.25} onChange={setRiskPremium} />
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Override % (optional)</label>
            <input
              type="number"
              step={0.25}
              value={rateOverride}
              onChange={e => setRateOverride(e.target.value)}
              placeholder="—"
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1.5 tabular-nums"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">Effective rate</span>
          <span className="text-base font-bold text-amber-300 tabular-nums">
            {tillResult.annualRatePct.toFixed(2)}%
          </span>
          <span className="text-[10px] text-slate-500">
            (source: {tillResult.source === "attorney_override" ? "attorney override" : "WSJ prime + premium"})
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 italic">
          Total secured monthly payment across all crammed claims: <strong className="text-slate-300 tabular-nums">{fmt(securedMonthlyTotal)}</strong>
        </p>
      </Section>

      <Section title="Plan Cost — Conduit + Trustee Fee" icon={<DollarSign className="w-4 h-4 text-sky-400" />}>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <ConduitToggle
            on={conduitOn}
            mortgageArrearsInPlan={props.mortgageArrearsInPlan}
            overridden={conduitOverride !== null}
            onChange={v => setConduitOverride(v === props.mortgageArrearsInPlan ? null : v)}
          />
          <span className="text-[10px] text-slate-500">
            Conduit inflates BOTH the disbursement base and the trustee fee.
          </span>
        </div>
        {!medianAvailable ? (
          // Suppress confident plan-cost numbers when the commitment period
          // can't be classified. The internal math still runs against the
          // 60-month default (the plan-cost engine needs SOME term), but
          // the displayed figures must not read as authoritative — the
          // attorney would otherwise commit to a 5-year fee that may be
          // wrong for a below-median debtor entitled to the 36-month plan.
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-200 leading-relaxed">
              <strong className="text-amber-300">Plan cost pending state median.</strong>
              {" "}
              Disbursement base, trustee fee, and monthly plan payment can't be presented as
              authoritative until § 1325(b)(4) commitment-period classification resolves.
              See the Commitment Period section above.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <Stat label="Disbursement base" value={fmt(planCost.disbursementBase)} />
              <Stat label={`Trustee fee (${planCost.multiplierUsed}% — ${props.venue})`} value={fmt(planCost.trusteeFee)} />
              <Stat
                label="Monthly plan payment"
                value={fmt(planCost.monthlyPlanPayment)}
                tone="amber"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] text-slate-400">
              <BreakdownPill label="Unsecured dist." value={fmt(planCost.breakdown.unsecuredDistribution)} />
              <BreakdownPill label="Secured cramdown" value={fmt(planCost.breakdown.securedCramdownPayments)} />
              <BreakdownPill label="Arrears cure" value={fmt(planCost.breakdown.arrearsCure)} />
              <BreakdownPill label="Priority" value={fmt(planCost.breakdown.priorityClaims)} />
              <BreakdownPill
                label={`Ongoing mortgage ${conduitOn ? "(in base)" : "(direct)"}`}
                value={fmt(planCost.breakdown.ongoingMortgageInBase)}
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Best-Interests Floor (§ 1325(a)(4))" icon={<Home className="w-4 h-4 text-sky-400" />}>
        {props.bestInterestsFloor == null ? (
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200 leading-relaxed">
              Best-interests floor not yet available. Mount the Ch.7 Exemptions &amp; Liquidation panel
              on this case (it emits the non-exempt total via <code className="text-amber-300">onTotalsChange</code>);
              the floor flows here automatically. The engine treats this number as the minimum
              dividend to general unsecured creditors — undiscounted (§ 1325(a)(5) present-value
              discounting is a separate computation).
            </p>
          </div>
        ) : (
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-2xl font-bold text-emerald-300 tabular-nums">{fmt(props.bestInterestsFloor)}</span>
            <span className="text-[10px] text-slate-500">
              From the Ch.7 liquidation panel (non-exempt equity, gross of trustee costs).
              Reused — NOT recomputed here.
            </span>
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function AntiModificationCard({ claim }: { claim: Ch13SecuredClaimInput }) {
  const equity = claim.kbbPrivateParty - claim.claimAmount;
  const underwater = equity < 0;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">{claim.label}</p>
          <p className="text-[10px] text-slate-400">
            Claim {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(claim.claimAmount)}
            {" · "}collateral value {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(claim.kbbPrivateParty)}
            {underwater && <span className="text-amber-300"> · underwater {fmt(Math.abs(equity))}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5 border-amber-500/40 text-amber-300 bg-amber-500/10">
            anti-mod § 1322(b)(2)
          </span>
          <span className="text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5 border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
            cure-and-maintain § 1322(b)(5)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <Stat label="Ongoing monthly payment" value={fmt(claim.ongoingMonthlyPayment ?? null)} />
        <Stat label="Pre-petition arrears cure" value={fmt(claim.cureArrears ?? null)} />
        <div>
          <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">Treatment</p>
          <p className="text-[10px] text-slate-300 leading-snug">
            Ongoing payment rides through plan unmodified; arrears cured over the plan term.
          </p>
        </div>
      </div>

      <p className="text-[10px] text-amber-200 italic mt-2 leading-snug">
        <Info className="w-3 h-3 inline mr-1" />
        Not crammed under § 506(a). Even when undersecured (Nobelman, 508 U.S. 324), the
        principal-residence mortgage rides through at its contract terms.
        {underwater && " Wholly-underwater status here is informational only — does not unlock cramdown."}
      </p>
    </div>
  );
}

function ClaimCard({
  claim, result, fmvOverrideValue, onFmvChange,
  reclassified, onReclassify, isLawyer,
}: {
  claim: Ch13SecuredClaimInput;
  result: BifurcationResult;
  fmvOverrideValue: string;
  onFmvChange: (v: string) => void;
  reclassified: boolean;
  onReclassify: (next: boolean) => void;
  isLawyer: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">{claim.label}</p>
          <p className="text-[10px] text-slate-500">
            Claim {fmt(claim.claimAmount)} · KBB private-party {fmt(claim.kbbPrivateParty)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {result.hangingParagraphProtected && (
            <span className="text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5 border-amber-500/40 text-amber-300 bg-amber-500/10">
              hanging paragraph
            </span>
          )}
          {result.reclassifiedUnsecured && (
            <span className="text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5 border-rose-500/40 text-rose-300 bg-rose-500/10">
              D → unsecured
            </span>
          )}
          <span className="text-[9px] uppercase tracking-widest text-slate-400">
            {result.valuationSource === "attorney_fmv_override" ? "FMV override" : "KBB"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
        <Stat label="Secured" value={fmt(result.securedValue)} tone="emerald" />
        <Stat label="Unsecured deficiency" value={fmt(result.unsecuredDeficiency)} tone="rose" />
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">FMV override</label>
          <input
            type="number"
            value={fmvOverrideValue}
            onChange={e => onFmvChange(e.target.value)}
            placeholder={`KBB ${fmt(claim.kbbPrivateParty)}`}
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1 tabular-nums"
          />
        </div>
        {/* Per-claim D → unsecured reclassification. Attorney-only —
            non-lawyers don't see the control at all (per spec). */}
        {isLawyer ? (
          <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-300 self-end">
            <input
              type="checkbox"
              checked={reclassified}
              onChange={e => onReclassify(e.target.checked)}
              className="accent-rose-500"
            />
            <span>D → unsecured (no longer held / surrendered)</span>
          </label>
        ) : (
          <div className="self-end text-[10px] text-slate-600 italic">attorney-only control</div>
        )}
      </div>
      <p className="text-[10px] text-slate-500 italic mt-2 leading-snug">
        <Info className="w-3 h-3 inline mr-1" />{result.note}
      </p>
    </div>
  );
}

function ConduitToggle({
  on, mortgageArrearsInPlan, overridden, onChange,
}: {
  on: boolean;
  mortgageArrearsInPlan: boolean;
  overridden: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
        <input
          type="checkbox"
          checked={on}
          onChange={e => onChange(e.target.checked)}
          className="accent-sky-500"
        />
        <span>Conduit (mortgage arrears in plan)</span>
      </label>
      {overridden && (
        <button
          type="button"
          onClick={() => onChange(mortgageArrearsInPlan)}
          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-300"
          title="Reset to the case-level arrears flag"
        >
          <RefreshCcw className="w-3 h-3" /> reset
        </button>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "emerald" | "rose" }) {
  const color =
    tone === "amber"   ? "text-amber-300"
    : tone === "emerald" ? "text-emerald-300"
    : tone === "rose"  ? "text-rose-300"
    : "text-white";
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function BreakdownPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-[11px] font-semibold tabular-nums text-slate-200">{value}</p>
    </div>
  );
}

function NumInput({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1.5 tabular-nums"
      />
    </div>
  );
}
