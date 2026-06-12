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

import { useMemo, useState, useCallback, type ReactNode } from "react";
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
  classifyJuniorLiens,
  type Ch13SecuredClaimInput as Ch13SecuredClaimInputLib,
  type JuniorLien,
} from "../../lib/ch13Derive";
import { useRulesAudit } from "../law-firm-settings/rulesAuditStore";

// Re-export the pure-lib type as a Ch13Eligibility-scoped alias so existing
// imports (`import { Ch13SecuredClaimInput } from "./Ch13Eligibility"`)
// keep compiling unchanged.
export type Ch13SecuredClaimInput = Ch13SecuredClaimInputLib;

// Ch13SecuredClaimInput lives in src/lib/ch13Derive.ts now (pure data
// shape, no React). Re-exported above as the same name for unchanged
// downstream imports.

export interface Ch13EligibilityProps {
  /** Case id — anchors every attorney-override audit entry so the
   *  rulesAuditStore log can be filtered per case. Today the parent
   *  hard-codes "client-demo"; the real case id threads through when
   *  AttorneyReviewRecord plumbing lands. */
  caseId: string;
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
  // Per-claim purchase / origination date (ISO yyyy-mm-dd). Drives the
  // engine's 910 / 365 hanging-paragraph windows when paired with the
  // per-case filing date below. Attorney-entered because intake doesn't
  // reliably populate these dates today.
  const [purchaseDates, setPurchaseDates] = useState<Record<string, string>>({});
  // Per-case bankruptcy filing date (ISO yyyy-mm-dd). Attorney sets the
  // anticipated filing date so the hanging-paragraph windows resolve to
  // the moment of filing.
  const [filingDate, setFilingDate] = useState<string>("");
  // Per-claim Statement of Intention. retain = default; surrender →
  // reclassifiedUnsecured (engine's existing path); redeem = retain
  // with a one-time payoff (engine treats as retain for cramdown math).
  const [intention, setIntention] = useState<Record<string, "retain" | "surrender" | "redeem">>({});
  // Attorney-entered priority-pool override + per-category breakdown
  // visible. Today the engine's priorityClaims is computed via
  // deriveBatch3FromIntake; this surface lets the attorney see the
  // breakdown and override the total when intake numbers are incomplete.
  const [priorityOverride, setPriorityOverride] = useState<string>("");
  // Per-anti-mod-claim junior liens on the SAME collateral. Used by
  // classifyJuniorLiens to flag wholly-unsecured juniors as strip-
  // eligible (jurisdiction-dependent; attorney-confirmed). Intake
  // doesn't capture junior liens — attorney-entered on the anti-mod card.
  // TODO: persist via meansTestOverrides or a dedicated lien store.
  const [juniorLiens, setJuniorLiens] = useState<Record<string, JuniorLien[]>>({});
  // Conduit toggle is plumbed through to the engine via prop, but we
  // mirror it locally so the UI can simulate "what if" without changing
  // the parent.
  const [conduitOverride, setConduitOverride] = useState<boolean | null>(null);
  const conduitOn = conduitOverride ?? props.mortgageArrearsInPlan;

  // ─── Audit + reason capture ────────────────────────────────────────
  //
  // Every attorney override below is logged to rulesAuditStore.recordChange
  // — same pattern as setCaseDeductionOverride in LongFormDeductionPanel.
  // The reasons map mirrors the LongFormDeductionPanel pattern: an
  // optional free-text reason keyed by audit path, surfaced inline next
  // to legally-consequential controls and folded into recordChange's
  // `source` so audit reviewers see *why* the attorney departed from the
  // canonical value. Low-stakes / default-matching changes still log,
  // but the reason input only renders when the override deviates and
  // its absence isn't blocking.
  const audit = useRulesAudit();
  const actor = props.isLawyer ? "attorney_signing_review" : "staff_signing_review";
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const setReason = useCallback((path: string, next: string) => {
    setReasons(prev => ({ ...prev, [path]: next }));
  }, []);
  // Section key — ch13_case_override is the dedicated bucket for per-case
  // attorney overrides on the Ch.13 review surface. Distinct from
  // ch13_admin_multipliers (which is firm-level trustee-fee schedule
  // data) so the per-case audit trail doesn't pollute firm-rule history.
  const recordOverride = useCallback((args: {
    field: string;
    oldValue: string | number | null;
    newValue: string | number | null;
    label: string;
  }) => {
    const path = `ch13_review.${props.caseId}.${args.field}`;
    const reason = (reasons[path] ?? "").trim();
    audit.recordChange({
      section: "ch13_case_override",
      actor,
      path,
      oldValue: args.oldValue,
      newValue: args.newValue,
      source: reason ? `${args.label} — reason: ${reason}` : args.label,
    });
  }, [audit, actor, reasons, props.caseId]);

  // Setter wrappers — preserve the existing local-state behavior and
  // additionally fire recordOverride. Per-case fields below; per-claim
  // wrappers are constructed in the bifurcation map and on the ClaimCard
  // / AntiModificationCard props.
  const onChangeWsjPrime = useCallback((next: number) => {
    const prev = wsjPrime;
    setWsjPrime(next);
    if (prev !== next) {
      recordOverride({
        field: "till.wsj_prime",
        oldValue: prev,
        newValue: next,
        label: "Till — WSJ prime",
      });
    }
  }, [wsjPrime, recordOverride]);
  const onChangeRiskPremium = useCallback((next: number) => {
    const prev = riskPremium;
    setRiskPremium(next);
    if (prev !== next) {
      recordOverride({
        field: "till.risk_premium",
        oldValue: prev,
        newValue: next,
        label: "Till — risk premium",
      });
    }
  }, [riskPremium, recordOverride]);
  const onChangeRateOverride = useCallback((next: string) => {
    const prev = rateOverride;
    setRateOverride(next);
    if (prev !== next) {
      recordOverride({
        field: "till.rate_override_pct",
        oldValue: prev === "" ? null : prev,
        newValue: next === "" ? null : next,
        label: "Till — attorney rate override",
      });
    }
  }, [rateOverride, recordOverride]);
  const onChangeFilingDate = useCallback((next: string) => {
    const prev = filingDate;
    setFilingDate(next);
    if (prev !== next) {
      recordOverride({
        field: "filing_date",
        oldValue: prev === "" ? null : prev,
        newValue: next === "" ? null : next,
        label: "Filing date (drives 910/365 hanging-paragraph windows)",
      });
    }
  }, [filingDate, recordOverride]);
  const onChangePriorityOverride = useCallback((next: string) => {
    const prev = priorityOverride;
    setPriorityOverride(next);
    if (prev !== next) {
      recordOverride({
        field: "priority_pool_override",
        oldValue: prev === "" ? null : parseFloat(prev),
        newValue: next === "" ? null : parseFloat(next),
        label: "§ 507 priority pool — attorney override",
      });
    }
  }, [priorityOverride, recordOverride]);
  const onChangeConduit = useCallback((next: boolean) => {
    const prev = conduitOn;
    // The conduit prop is a boolean; null in state means "follow intake".
    const nextOverride = next === props.mortgageArrearsInPlan ? null : next;
    setConduitOverride(nextOverride);
    if (prev !== next) {
      recordOverride({
        field: "conduit_on",
        oldValue: prev ? 1 : 0,
        newValue: next ? 1 : 0,
        label: "Conduit toggle (inflates disbursement base + trustee fee)",
      });
    }
  }, [conduitOn, props.mortgageArrearsInPlan, recordOverride]);

  // Per-claim setter wrappers — keyed by claim id so the audit path
  // identifies which secured claim was edited.
  const onChangeFmv = useCallback((claimId: string, next: string) => {
    const prev = fmvOverrides[claimId] ?? "";
    setFmvOverrides(s => ({ ...s, [claimId]: next }));
    if (prev !== next) {
      recordOverride({
        field: `secured_claims.${claimId}.fmv_override`,
        oldValue: prev === "" ? null : parseFloat(prev),
        newValue: next === "" ? null : parseFloat(next),
        label: "FMV override (§ 506(a) valuation)",
      });
    }
  }, [fmvOverrides, recordOverride]);
  const onChangeReclassified = useCallback((claimId: string, next: boolean) => {
    const prev = reclassified[claimId] === true;
    setReclassified(s => ({ ...s, [claimId]: next }));
    if (prev !== next) {
      recordOverride({
        field: `secured_claims.${claimId}.d_to_unsecured`,
        oldValue: prev ? 1 : 0,
        newValue: next ? 1 : 0,
        label: "D → unsecured reclassification (no longer held)",
      });
    }
  }, [reclassified, recordOverride]);
  const onChangePurchaseDate = useCallback((claimId: string, next: string) => {
    const prev = purchaseDates[claimId] ?? "";
    setPurchaseDates(s => ({ ...s, [claimId]: next }));
    if (prev !== next) {
      recordOverride({
        field: `secured_claims.${claimId}.purchase_date`,
        oldValue: prev === "" ? null : prev,
        newValue: next === "" ? null : next,
        label: "Purchase / origination date (drives 910/365 windows)",
      });
    }
  }, [purchaseDates, recordOverride]);
  const onChangeIntent = useCallback(
    (claimId: string, next: "retain" | "surrender" | "redeem") => {
      const prev = intention[claimId] ?? "retain";
      setIntention(s => ({ ...s, [claimId]: next }));
      if (prev !== next) {
        recordOverride({
          field: `secured_claims.${claimId}.intent`,
          oldValue: prev,
          newValue: next,
          label: `Statement of Intention § 521(a)(2) → ${next}${next === "surrender" ? " (drops cramdown; claim → unsecured pool)" : ""}`,
        });
      }
    },
    [intention, recordOverride],
  );
  const onChangeJuniorLiens = useCallback(
    (claimId: string, next: JuniorLien[]) => {
      const prev = juniorLiens[claimId] ?? [];
      setJuniorLiens(s => ({ ...s, [claimId]: next }));
      // Snapshot the cardinality + total balance into the audit log —
      // the lien store is the source-of-truth for shape; the audit log
      // captures "what changed when".
      const sum = (xs: ReadonlyArray<JuniorLien>) =>
        xs.reduce((acc, j) => acc + (Number.isFinite(j.balance) ? j.balance : 0), 0);
      const prevBalance = sum(prev);
      const nextBalance = sum(next);
      if (prev.length !== next.length || prevBalance !== nextBalance) {
        recordOverride({
          field: `secured_claims.${claimId}.junior_liens`,
          oldValue: `${prev.length} lien(s), total ${prevBalance}`,
          newValue: `${next.length} lien(s), total ${nextBalance}`,
          label: "Junior liens on residence (wholly-unsecured strip per Zimmer / Tanner / Lane)",
        });
      }
    },
    [juniorLiens, recordOverride],
  );

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
        // Statement of Intention — surrender flips the engine's
        // reclassifiedUnsecured flag (no collateral to bifurcate).
        const intent = intention[c.id];
        const surrendered = intent === "surrender";
        const reclassifiedFlag = surrendered || reclassified[c.id] === true;
        // Per-claim purchase date attorney-entered; per-case filing date.
        // The engine's resolveDaysSincePurchase prefers the date pair over
        // any numeric daysSincePurchase already on the claim.
        const purchaseDateOverride = purchaseDates[c.id]?.trim() || undefined;
        const r = bifurcate({
          claimAmount: c.claimAmount,
          kbbPrivateParty: c.kbbPrivateParty,
          fmvOverride: fmvOverride ?? null,
          reclassifiedUnsecured: reclassifiedFlag,
          hangingParagraph: {
            isMotorVehicle: c.isMotorVehicle,
            isPersonalUseVehicle: c.isPersonalUseVehicle,
            daysSincePurchase: c.daysSincePurchase,
            purchaseDate: purchaseDateOverride,
            filingDate: filingDate.trim() || undefined,
            isOtherPurchaseMoney: c.isOtherPurchaseMoney,
            // Surrender (or attorney reclassification) flips retained →
            // false at the engine level too, so the hanging-paragraph
            // guard doesn't fire on a non-retained item.
            isRetained: c.isRetained && !reclassifiedFlag,
          },
        });
        return { claim: c, result: r, intent, purchaseDateOverride };
      });
  }, [props.securedClaims, reclassified, fmvOverrides, purchaseDates, filingDate, intention]);

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
    const overrideRaw = parseFloat(priorityOverride);
    const effectivePriority = Number.isFinite(overrideRaw) && overrideRaw >= 0
      ? overrideRaw
      : props.priorityClaims;
    return computeCh13PlanCost({
      unsecuredDistribution,
      securedCramdownPayments,
      arrearsCure: props.arrearsCure,
      priorityClaims: effectivePriority,
      mortgageArrearsInPlan: conduitOn,
      ongoingMortgageOverTerm: props.ongoingMortgageOverTerm,
      planMonths: props.planMonths,
      venue: props.venue,
    });
  }, [
    unsecuredDistribution, securedCramdownPayments, props.arrearsCure,
    props.priorityClaims, priorityOverride, conduitOn, props.ongoingMortgageOverTerm,
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
              <AntiModificationCard
                key={claim.id}
                claim={claim}
                caseId={props.caseId}
                isLawyer={props.isLawyer}
                venue={props.venue}
                juniors={juniorLiens[claim.id] ?? []}
                onJuniorsChange={next => onChangeJuniorLiens(claim.id, next)}
                reasons={reasons}
                onReasonChange={setReason}
              />
            ))}
            <p className="text-[10px] text-slate-500 italic leading-snug">
              <Info className="w-3 h-3 inline mr-1" />
              Per <em>Nobelman v. American Sav. Bank</em>, 508 U.S. 324 (1993), a security interest
              in real property that is the debtor's principal residence cannot be modified — even
              when undersecured. Treatment is cure-and-maintain under § 1322(b)(5).
              {" "}
              <strong className="text-amber-300">Wholly unsecured junior liens</strong> on the
              principal residence (where senior balances ≥ collateral value, leaving $0 securing
              the junior) MAY be strip-eligible (jurisdiction-dependent; <em>In re Zimmer</em>,
              313 F.3d 1220 (9th Cir. 2002) — primary for AZ / WA; accord <em>In re Tanner</em>,
              217 F.3d 1357 (11th Cir. 2000) and <em>In re Lane</em>, 280 F.3d 663 (6th Cir. 2002)).
              That is a separate attorney-confirmed determination — not
              auto-detected. Junior-lien capture lives on each anti-mod card below.
            </p>
          </div>
        </Section>
      )}

      <Section title="Secured-Claim Bifurcation (§ 506(a))" icon={<Car className="w-4 h-4 text-sky-400" />}>
        {/* Per-case filing date — attorney enters the anticipated filing
            date. Paired with per-claim purchase dates, drives the
            hanging-paragraph 910/365-day windows. */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-[10px] uppercase tracking-widest text-slate-400">
              Anticipated filing date
            </label>
            <input
              type="date"
              value={filingDate}
              onChange={e => onChangeFilingDate(e.target.value)}
              disabled={!props.isLawyer}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1 disabled:opacity-50"
            />
            {!filingDate && (
              <span className="text-[10px] text-amber-300 italic">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Filing date not set — 910/365 hanging-paragraph windows can't fire from dates alone
              </span>
            )}
          </div>
          {filingDate !== "" && (
            <input
              type="text"
              value={reasons[`ch13_review.${props.caseId}.filing_date`] ?? ""}
              onChange={e => setReason(`ch13_review.${props.caseId}.filing_date`, e.target.value)}
              placeholder="Reason / basis for filing date (logged to audit)"
              className="mt-2 w-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
            />
          )}
        </div>
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
                caseId={props.caseId}
                result={result}
                fmvOverrideValue={fmvOverrides[claim.id] ?? ""}
                onFmvChange={v => onChangeFmv(claim.id, v)}
                reclassified={reclassified[claim.id] === true}
                onReclassify={next => onChangeReclassified(claim.id, next)}
                isLawyer={props.isLawyer}
                purchaseDate={purchaseDates[claim.id] ?? ""}
                onPurchaseDateChange={v => onChangePurchaseDate(claim.id, v)}
                filingDate={filingDate}
                intent={intention[claim.id] ?? "retain"}
                onIntentChange={next => onChangeIntent(claim.id, next)}
                reasons={reasons}
                onReasonChange={setReason}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Till Rate (§ 1325(a)(5)(B)(ii))" icon={<Calculator className="w-4 h-4 text-sky-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <NumInput label="WSJ Prime %" value={wsjPrime} step={0.25} onChange={onChangeWsjPrime} />
          <NumInput label="Risk premium %" value={riskPremium} step={0.25} onChange={onChangeRiskPremium} />
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">Override % (optional)</label>
            <input
              type="number"
              step={0.25}
              value={rateOverride}
              onChange={e => onChangeRateOverride(e.target.value)}
              placeholder="—"
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1.5 tabular-nums"
            />
            {/* Reason capture — Till override is legally consequential
                (changes the cramdown amortization rate). Optional but
                strongly recommended; flows into audit `source`. */}
            {rateOverride.trim() !== "" && (
              <input
                type="text"
                value={reasons[`ch13_review.${props.caseId}.till.rate_override_pct`] ?? ""}
                onChange={e => setReason(`ch13_review.${props.caseId}.till.rate_override_pct`, e.target.value)}
                placeholder="Reason for Till override (logged to audit)"
                className="mt-1.5 w-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
              />
            )}
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
            onChange={onChangeConduit}
          />
          <span className="text-[10px] text-slate-500">
            Conduit inflates BOTH the disbursement base and the trustee fee.
          </span>
          {conduitOverride !== null && (
            <input
              type="text"
              value={reasons[`ch13_review.${props.caseId}.conduit_on`] ?? ""}
              onChange={e => setReason(`ch13_review.${props.caseId}.conduit_on`, e.target.value)}
              placeholder="Reason for conduit override (logged to audit)"
              className="basis-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
            />
          )}
        </div>
        {/* Attorney priority-pool override. Intake captures only taxDebt
            today; deriveBatch3FromIntake also sums dsoArrears + wagePriority
            when present. This input lets the attorney pin the full
            § 507 priority pool when intake numbers are incomplete. */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3 mb-4 flex items-center gap-3 flex-wrap">
          <label className="text-[10px] uppercase tracking-widest text-slate-400">
            § 507 priority pool (attorney)
          </label>
          <input
            type="number"
            step={100}
            min={0}
            value={priorityOverride}
            disabled={!props.isLawyer}
            onChange={e => onChangePriorityOverride(e.target.value)}
            placeholder={`From intake: ${fmt(props.priorityClaims)}`}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1 w-40 tabular-nums disabled:opacity-50"
          />
          <span className="text-[9px] text-slate-500 italic">
            Categories: taxes + DSO arrears + wage priority. Override pins the full pool.
          </span>
          {priorityOverride.trim() !== "" && (
            <input
              type="text"
              value={reasons[`ch13_review.${props.caseId}.priority_pool_override`] ?? ""}
              onChange={e => setReason(`ch13_review.${props.caseId}.priority_pool_override`, e.target.value)}
              placeholder="Reason for priority-pool override (logged to audit)"
              className="basis-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
            />
          )}
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

function AntiModificationCard({
  claim,
  caseId,
  isLawyer,
  venue,
  juniors,
  onJuniorsChange,
  reasons,
  onReasonChange,
}: {
  claim: Ch13SecuredClaimInput;
  caseId: string;
  isLawyer: boolean;
  venue: CH13Venue;
  juniors: ReadonlyArray<JuniorLien>;
  onJuniorsChange: (next: JuniorLien[]) => void;
  reasons: Record<string, string>;
  onReasonChange: (path: string, next: string) => void;
}) {
  // Path for the single per-card strip-treatment reason. The reason is
  // logged whenever juniors[] mutates (via the parent's audit wrapper
  // in onJuniorsChange) — captured here, applied there.
  const stripReasonPath = `ch13_review.${caseId}.secured_claims.${claim.id}.junior_liens`;
  // Venue → circuit. AZ + WA-W + WA-E all sit in the 9th Circuit, so
  // In re Zimmer is controlling for any case this app ships today;
  // the prompt asked for the venue-aware tag explicitly so other
  // circuits can be added without touching the citation logic.
  const isNinthCircuit = venue === "AZ" || venue === "WA-W" || venue === "WA-E";
  const equity = claim.kbbPrivateParty - claim.claimAmount;
  const underwater = equity < 0;
  // In re Zimmer (9th Cir.) / In re Tanner / In re Lane strip-
  // eligibility cascade. The senior here IS this anti-mod claim;
  // juniors are stacked above its balance.
  const classified = classifyJuniorLiens({
    collateralValue: claim.kbbPrivateParty,
    seniorBalance: claim.claimAmount,
    juniors,
  });
  const stripEligibleCount = classified.filter(j => j.whollyUnsecured).length;

  const addJunior = () => {
    const nextPosition = juniors.length === 0
      ? 2
      : Math.max(...juniors.map(j => j.position)) + 1;
    onJuniorsChange([
      ...juniors,
      {
        id: `jl-${Date.now()}`,
        label: "",
        balance: 0,
        position: nextPosition,
      },
    ]);
  };
  const updateJunior = (id: string, patch: Partial<JuniorLien>) => {
    onJuniorsChange(juniors.map(j => (j.id === id ? { ...j, ...patch } : j)));
  };
  const removeJunior = (id: string) => {
    onJuniorsChange(juniors.filter(j => j.id !== id));
  };

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

      {/* Junior liens — attorney-entered. Wholly-unsecured juniors on the
          principal residence are strip-eligible under In re Zimmer
          (9th Cir. — controlling for AZ/WA); accord In re Tanner /
          In re Lane (jurisdiction-dependent; attorney-confirmed). */}
      <div className="mt-3 rounded-md border border-slate-700 bg-slate-900/40 p-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">
            Junior liens on this collateral
            {stripEligibleCount > 0 && (
              <span className="ml-2 text-rose-300 normal-case tracking-normal">
                · {stripEligibleCount} wholly-unsecured (strip-eligible)
              </span>
            )}
          </p>
          {isLawyer && (
            <button
              type="button"
              onClick={addJunior}
              className="text-[10px] text-sky-300 hover:text-sky-200"
            >
              + add junior
            </button>
          )}
        </div>
        {juniors.length === 0 ? (
          <p className="text-[10px] text-slate-500 italic">
            None entered. Add HELOCs, second/third mortgages, or other
            consensual liens on this property to flag strip eligibility.
          </p>
        ) : (
          <div className="space-y-1">
            {classified.map(({ lien, whollyUnsecured, cushionAtThisPosition }) => (
              <div
                key={lien.id}
                className={`flex items-center gap-2 flex-wrap rounded px-2 py-1 border ${whollyUnsecured
                  ? "border-rose-500/40 bg-rose-500/5"
                  : "border-slate-700 bg-slate-900/30"}`}
              >
                <input
                  type="number"
                  min={2}
                  value={lien.position}
                  disabled={!isLawyer}
                  onChange={e => updateJunior(lien.id, { position: parseInt(e.target.value, 10) || 2 })}
                  className="w-12 bg-slate-800 border border-slate-700 text-white text-[10px] rounded px-1 py-0.5 tabular-nums disabled:opacity-50"
                  title="Lien position"
                />
                <input
                  type="text"
                  value={lien.label}
                  disabled={!isLawyer}
                  onChange={e => updateJunior(lien.id, { label: e.target.value })}
                  placeholder="Label (HELOC, 2nd mortgage, …)"
                  className="flex-1 min-w-[120px] bg-slate-800 border border-slate-700 text-white text-[10px] rounded px-2 py-0.5 disabled:opacity-50"
                />
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={lien.balance || ""}
                  disabled={!isLawyer}
                  onChange={e => updateJunior(lien.id, { balance: parseFloat(e.target.value) || 0 })}
                  placeholder="Balance"
                  className="w-28 bg-slate-800 border border-slate-700 text-white text-[10px] rounded px-2 py-0.5 tabular-nums disabled:opacity-50"
                />
                <span
                  className={`text-[10px] tabular-nums ${whollyUnsecured ? "text-rose-300" : "text-slate-400"}`}
                  title="Equity cushion above this lien"
                >
                  cushion {fmt(cushionAtThisPosition)}
                </span>
                {whollyUnsecured && (
                  <span className="text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5 border-rose-500/40 text-rose-300 bg-rose-500/10">
                    strip-eligible
                  </span>
                )}
                {isLawyer && (
                  <button
                    type="button"
                    onClick={() => removeJunior(lien.id)}
                    className="text-[10px] text-slate-500 hover:text-rose-300"
                  >
                    remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {stripEligibleCount > 0 && (
          <>
            <p className="text-[10px] text-rose-200 italic mt-2 leading-snug">
              <Info className="w-3 h-3 inline mr-1" />
              Wholly-unsecured junior liens on the principal residence may be
              stripped under <em>In re Zimmer</em>, 313 F.3d 1220 (9th Cir. 2002)
              {isNinthCircuit && (
                <span className="not-italic text-rose-300 font-semibold"> (controlling — venue {venue}, 9th Cir.)</span>
              )}
              ; accord <em>In re Tanner</em>, 217 F.3d 1357 (11th Cir. 2000)
              and <em>In re Lane</em>, 280 F.3d 663 (6th Cir. 2002).
              Attorney-confirmed; jurisdiction-dependent. Footnote treatment
              applies; engine math is unchanged here.
            </p>
            {isLawyer && (
              <input
                type="text"
                value={reasons[stripReasonPath] ?? ""}
                onChange={e => onReasonChange(stripReasonPath, e.target.value)}
                placeholder="Reason / strip-treatment rationale (logged to audit on next lien change)"
                className="mt-2 w-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
              />
            )}
          </>
        )}
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
  claim, caseId, result, fmvOverrideValue, onFmvChange,
  reclassified, onReclassify, isLawyer,
  purchaseDate, onPurchaseDateChange,
  filingDate, intent, onIntentChange,
  reasons, onReasonChange,
}: {
  claim: Ch13SecuredClaimInput;
  caseId: string;
  result: BifurcationResult;
  fmvOverrideValue: string;
  onFmvChange: (v: string) => void;
  reclassified: boolean;
  onReclassify: (next: boolean) => void;
  isLawyer: boolean;
  purchaseDate: string;
  onPurchaseDateChange: (v: string) => void;
  filingDate: string;
  intent: "retain" | "surrender" | "redeem";
  onIntentChange: (next: "retain" | "surrender" | "redeem") => void;
  reasons: Record<string, string>;
  onReasonChange: (path: string, next: string) => void;
}) {
  // Audit-path prefixes for the per-claim controls — keyed off claim.id so
  // each claim has its own reason slot in the parent's reasons map.
  const fmvPath = `ch13_review.${caseId}.secured_claims.${claim.id}.fmv_override`;
  const reclassifyPath = `ch13_review.${caseId}.secured_claims.${claim.id}.d_to_unsecured`;
  const purchasePath = `ch13_review.${caseId}.secured_claims.${claim.id}.purchase_date`;
  const intentPath = `ch13_review.${caseId}.secured_claims.${claim.id}.intent`;
  // "Dates unknown" notice when either date is missing — explicit so the
  // attorney sees that protection ISN'T being applied silently.
  const datesKnown = purchaseDate.trim() !== "" && filingDate.trim() !== "";
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
          {fmvOverrideValue.trim() !== "" && (
            <input
              type="text"
              value={reasons[fmvPath] ?? ""}
              onChange={e => onReasonChange(fmvPath, e.target.value)}
              placeholder="Reason for FMV override (logged to audit)"
              className="mt-1 w-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
            />
          )}
        </div>
        {/* Per-claim D → unsecured reclassification. Attorney-only —
            non-lawyers don't see the control at all (per spec). */}
        {isLawyer ? (
          <div className="self-end">
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-300">
              <input
                type="checkbox"
                checked={reclassified}
                onChange={e => onReclassify(e.target.checked)}
                className="accent-rose-500"
              />
              <span>D → unsecured (no longer held)</span>
            </label>
            {reclassified && (
              <input
                type="text"
                value={reasons[reclassifyPath] ?? ""}
                onChange={e => onReasonChange(reclassifyPath, e.target.value)}
                placeholder="Reason for D → unsecured (logged to audit)"
                className="mt-1 w-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
              />
            )}
          </div>
        ) : (
          <div className="self-end text-[10px] text-slate-600 italic">attorney-only control</div>
        )}
      </div>

      {/* Attorney-entered: purchase/origination date + Statement of
          Intention. Both default off because intake doesn't reliably
          capture these. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">
            Purchase / origination date (attorney-entered)
          </label>
          <input
            type="date"
            value={purchaseDate}
            disabled={!isLawyer}
            onChange={e => onPurchaseDateChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1 disabled:opacity-50"
          />
          {!datesKnown && (
            <p className="text-[9px] text-amber-300/80 mt-1 italic leading-snug">
              <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
              Dates unknown — hanging-paragraph protection not applied; attorney can set.
            </p>
          )}
          {purchaseDate.trim() !== "" && (
            <input
              type="text"
              value={reasons[purchasePath] ?? ""}
              onChange={e => onReasonChange(purchasePath, e.target.value)}
              placeholder="Reason / basis for purchase date (logged to audit)"
              className="mt-1 w-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
            />
          )}
        </div>
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-slate-500 mb-1">
            Statement of Intention (§ 521(a)(2))
          </label>
          <select
            value={intent}
            disabled={!isLawyer}
            onChange={e => onIntentChange(e.target.value as "retain" | "surrender" | "redeem")}
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1 disabled:opacity-50"
          >
            <option value="retain">Retain (keep collateral)</option>
            <option value="surrender">Surrender (give back to creditor)</option>
            <option value="redeem">Redeem (one-time payoff at value)</option>
          </select>
          {intent === "surrender" && (
            <p className="text-[9px] text-rose-300/80 mt-1 italic leading-snug">
              Surrender → entire claim falls into the unsecured pool; collateral not retained.
            </p>
          )}
          {/* Reason capture only on the legally-consequential intents
              (surrender drops cramdown; redeem implies one-time payoff).
              `retain` is the default — no reason prompted. */}
          {(intent === "surrender" || intent === "redeem") && (
            <input
              type="text"
              value={reasons[intentPath] ?? ""}
              onChange={e => onReasonChange(intentPath, e.target.value)}
              placeholder={`Reason for ${intent} (logged to audit)`}
              className="mt-1 w-full bg-slate-800 border border-amber-500/40 text-amber-100 text-[10px] rounded px-2 py-1 placeholder:text-slate-500"
            />
          )}
        </div>
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
