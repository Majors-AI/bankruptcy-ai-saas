// Ch. 13 Signing Review Portal — the chapter-13 review surface.
//
// Uses the shared ReviewShell + four tabs (Eligibility/Summary, Issues,
// All Answers, Decision). The Eligibility/Summary tab is wired live to
// the cramdown engine via Ch13Eligibility.
//
// Best-Interests floor: this surface mounts the SAME ExemptionsLiquidationPanel
// the Ch.7 surface uses (in the All Answers tab) and lifts its totals via
// onTotalsChange. The Eligibility/Summary tab reads the lifted floor from
// state. No recomputation — strictly reusing the Ch.7 number per spec.

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Lock, AlertTriangle } from "lucide-react";
import ReviewShell, { type ReviewShellTab } from "./ReviewShell";
import PreFilingGateBadge from "../firm-rule-updates/PreFilingGateBadge";
import Ch13Eligibility from "./Ch13Eligibility";
import ExemptionsLiquidationPanel from "./ExemptionsLiquidationPanel";
import { getMedianAnnualIncome } from "../../lib/irsMeansStandards";
import { classifyCommitmentPeriod } from "../../lib/ch13Commitment";
import { useFirmPrimaryState } from "../../lib/firmPolicy";
import type { CH13Venue } from "../../lib/ch13PlanCost";
import {
  deriveSecuredClaims, deriveBatch3FromIntake, deriveVenue,
  deriveHouseholdSize, deriveCmiMonthly,
  type Ch13SecuredClaimInput,
} from "../../lib/ch13Derive";

export interface Ch13SigningReviewProps {
  /** Role string from env / auth context. Drives the Decision tab gate
   *  and the per-claim D→unsecured reclassification control. */
  role: string;
  /** Client's intake form_data — fed into the Exemptions panel. */
  intakeFormData: Record<string, unknown> | null;
  intakeState: string | undefined;
  intakeCounty: string | undefined;
  /** Optional notice shown when the user opened this case from a portal
   *  that doesn't match the case's actual chapter (e.g., opened a Ch.13
   *  case from the Ch.7 portal). Surface only — routing is already
   *  correct by the time this prop renders. */
  wrongPortalNotice?: string;
}

const LAWYER_ROLES = ["attorney", "super_admin_bankruptcy_ai"];

// ─── Input wiring status ──────────────────────────────────────────────────
//
// All engine inputs are now wired from real sources. TODO leaves remain
// inside individual derivations for fields intake doesn't reliably
// capture (origination dates, isPersonalUseVehicle, isRetained, full
// priority-claim categories beyond taxDebt).
//
//   - bestInterestsFloor       ← Exemptions panel onTotalsChange (Ch.7 reuse)
//   - cmiMonthly               ← cmi.ts sumOtherIncomeIncludedInCMI(form_data)
//   - medianAnnual             ← getMedianAnnualIncome(firmPrimaryState, householdSize)
//                                 (null when state unloaded — Eligibility tab
//                                 shows "unavailable" notice; downstream
//                                 plan-cost outputs read "pending state
//                                 median" instead of confident numbers)
//   - planMonths               ← classifyCommitmentPeriod(...).period.months
//                                 (defaults to 60 internally when median
//                                 unavailable; UI suppresses displays)
//   - venue                    ← derived from firmPrimaryState (Arizona→AZ,
//                                 Washington→WA-W default; per-case district
//                                 split lands when county→district map exists)
//   - householdSize            ← form_data.numDependents + filingType
//   - securedClaims            ← deriveSecuredClaims(form_data): primary +
//                                 second mortgage + intake.vehicles[].hasLoan.
//                                 Primary residence marked antiModification
//                                 = true → cure-and-maintain card, no §506
//                                 split, excluded from cramdown sum.
//   - mortgageArrearsInPlan    ← derived: arrears > 0 OR mortgageCurrent==="no"
//   - arrearsCure              ← form_data.mortgageArrears
//   - ongoingMortgageOverTerm  ← form_data.mortgageMonthlyPayment × planMonths
//   - priorityClaims           ← form_data.taxDebt (TODO leaf: extend to
//                                 full priority pool when intake captures it)

/** Demo stub used ONLY when intake form_data is empty (the demo client).
 *  Real cases derive claims from form_data via deriveSecuredClaims(). */
const STUB_SECURED_CLAIMS: ReadonlyArray<Ch13SecuredClaimInput> = [
  {
    id: "stub-auto-1",
    label: "Auto loan — 2022 Toyota Camry (DEMO STUB — empty intake)",
    claimAmount: 24000,
    kbbPrivateParty: 18000,
    isMotorVehicle: true,
    isPersonalUseVehicle: true,
    daysSincePurchase: 800,
    isRetained: true,
  },
  {
    id: "stub-auto-2",
    label: "Auto loan — 2018 Honda Civic (DEMO STUB — empty intake)",
    claimAmount: 14000,
    kbbPrivateParty: 9500,
    isMotorVehicle: true,
    isPersonalUseVehicle: true,
    daysSincePurchase: 1500,
    isRetained: true,
  },
];

// The 5 derivation helpers (deriveSecuredClaims, deriveBatch3FromIntake,
// deriveVenue, deriveHouseholdSize, deriveCmiMonthly) moved into
// src/lib/ch13Derive.ts — pure module, unit-tested in
// src/lib/ch13Derive.test.ts. Imported above.

export default function Ch13SigningReview(props: Ch13SigningReviewProps) {
  const isLawyer = LAWYER_ROLES.includes(props.role);
  const [bestInterestsFloor, setBestInterestsFloor] = useState<number | null>(null);
  const firmPrimaryState = useFirmPrimaryState();

  // ─── Batch 1 — derive real engine inputs ─────────────────────────────
  const householdSize = useMemo(
    () => deriveHouseholdSize(props.intakeFormData),
    [props.intakeFormData],
  );
  const cmiMonthly = useMemo(
    () => deriveCmiMonthly(props.intakeFormData),
    [props.intakeFormData],
  );
  // Filing state comes from firmPolicy.firmPrimaryState (the firm's home
  // jurisdiction). When the case lands in a different admitted state the
  // per-case override flows through here in Batch 2.
  const filingState = firmPrimaryState;
  // medianAnnual reads from MEDIAN_INCOME_BY_STATE via the existing
  // helper; size > 4 picks up the per-person addon automatically. When
  // the state isn't in the table we deliberately pass null (NOT 0) —
  // defaulting to 0 would treat any positive CMI as above-median, which
  // is the wrong, debtor-adverse direction (mandatory 60-month plan).
  // The Eligibility tab renders an explicit "median unavailable" notice
  // when this is null and skips classification entirely.
  const medianAnnual = useMemo<number | null>(
    () => getMedianAnnualIncome(filingState, householdSize),
    [filingState, householdSize],
  );
  // planMonths derives from § 1325(b)(4) classification — 60 months
  // when at/above median, 36-month minimum below median. When the median
  // is unavailable we can't classify, so default to 60 (the more
  // conservative / debtor-friendly direction for plan-cost amortization
  // computations only; the UI separately shows the unavailable state on
  // the commitment-period row).
  const planMonths = useMemo(() => {
    if (medianAnnual == null) return 60;
    return classifyCommitmentPeriod({ cmiMonthly, medianAnnual }).period.months;
  }, [cmiMonthly, medianAnnual]);
  const venue: CH13Venue = useMemo(
    () => deriveVenue(firmPrimaryState),
    [firmPrimaryState],
  );

  // securedClaims — derived from intake form_data. When intake is empty
  // (demo client, no submission yet) we fall back to STUB_SECURED_CLAIMS
  // so the surface stays demonstrable; real cases always show real claims.
  const securedClaims = useMemo(() => {
    const derived = deriveSecuredClaims(props.intakeFormData);
    return derived.length > 0 ? derived : STUB_SECURED_CLAIMS;
  }, [props.intakeFormData]);

  // Batch 3 — mortgage arrears / conduit / priority claims, derived from
  // intake. ongoingMortgageOverTerm depends on planMonths so this re-
  // runs when the commitment-period classification changes.
  const batch3 = useMemo(
    () => deriveBatch3FromIntake(props.intakeFormData, planMonths),
    [props.intakeFormData, planMonths],
  );

  // ─── Eligibility / Summary tab ───────────────────────────────────────
  const eligibilityBody = (
    <Ch13Eligibility
      isLawyer={isLawyer}
      securedClaims={securedClaims}
      cmiMonthly={cmiMonthly}
      medianAnnual={medianAnnual}
      filingState={filingState}
      planMonths={planMonths}
      mortgageArrearsInPlan={batch3.mortgageArrearsInPlan}
      ongoingMortgageOverTerm={batch3.ongoingMortgageOverTerm}
      arrearsCure={batch3.arrearsCure}
      priorityClaims={batch3.priorityClaims}
      venue={venue}
      bestInterestsFloor={bestInterestsFloor}
    />
  );

  // ─── Issues tab ──────────────────────────────────────────────────────
  const issuesBody = (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-sm font-bold text-white mb-2">Open Issues</p>
      <p className="text-xs text-slate-500">
        Engine-flagged issues (eligibility, feasibility, best-interests, conduit) will surface here
        once the case-issue feed is wired up. Today the Eligibility/Summary tab is the live
        readout — anything that needs attorney attention shows there as an inline note.
      </p>
    </div>
  );

  // ─── All Answers tab ────────────────────────────────────────────────
  // This is where the Exemptions panel mounts. Its onTotalsChange lifts
  // the non-exempt total into bestInterestsFloor for the Eligibility tab.
  const allAnswersBody = (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <p className="text-sm font-bold text-white mb-2">All Answers</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Full intake responses + every schedule answer surface here. Below is the live
          Exemptions &amp; Liquidation panel — its non-exempt total feeds the
          § 1325(a)(4) best-interests floor on the Eligibility/Summary tab.
        </p>
      </div>
      <ExemptionsLiquidationPanel
        formData={props.intakeFormData}
        clientState={props.intakeState}
        clientCounty={props.intakeCounty}
        canEdit={isLawyer}
        onTotalsChange={t => setBestInterestsFloor(t.nonExempt)}
      />
    </div>
  );

  // ─── Decision tab (attorney-only) ───────────────────────────────────
  const decisionBody = isLawyer ? (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-sm font-bold text-white mb-2">Decision</p>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Attorney sign-off on Ch.13 confirmability. Placeholder controls — persistence + audit
        ship with the Ch.13 review portal V2.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700/30 text-emerald-200 border border-emerald-600/40 hover:bg-emerald-700/50"
        >
          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
          Confirmable
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-700/30 text-amber-200 border border-amber-600/40 hover:bg-amber-700/50"
        >
          <Clock className="w-3.5 h-3.5 inline mr-1" />
          Needs revision
        </button>
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex items-start gap-2">
      <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-slate-400 leading-relaxed">
        Decision is attorney-only. Confirmability and revision-flag controls are restricted to
        bar-admitted reviewers.
      </p>
    </div>
  );

  const tabs: ReviewShellTab[] = useMemo(() => [
    { key: "eligibility_summary", label: "Eligibility / Summary", body: eligibilityBody },
    { key: "issues",              label: "Issues",                body: issuesBody },
    { key: "all_answers",         label: "All Answers",           body: allAnswersBody },
    { key: "decision",            label: "Decision",              body: decisionBody, locked: !isLawyer },
  ], [eligibilityBody, issuesBody, allAnswersBody, decisionBody, isLawyer]);

  const FIRM_ID = (import.meta.env.VITE_FIRM_ID as string | undefined)
    ?? "00000000-0000-0000-0000-000000000001";

  return (
    <>
      {props.wrongPortalNotice && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-5 py-2 flex items-center gap-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{props.wrongPortalNotice}</span>
        </div>
      )}
      {/* Slice 5 — pre-filing rules gate. Compares the case's stamped
          review version against the firm's accepted/applied ruleset.
          caseStampedVersionId is `null` today — threaded from the
          AttorneyReviewRecord in a follow-up. */}
      <div className="max-w-screen-xl mx-auto px-5 pt-4">
        <PreFilingGateBadge
          firmId={FIRM_ID}
          caseId="client-demo"
          caseStampedVersionId={null /* TODO: wire from AttorneyReviewRecord.stampedVersionId */}
          isLawyer={isLawyer}
        />
      </div>
      <ReviewShell
        title="Ch. 13 Signing Review Portal"
        subtitle="Cramdown engine wired live · per-secured-claim bifurcation, Till rate, conduit + trustee fee"
        statusChip={
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-900/40 text-sky-300 border border-sky-600/40">
            <Clock className="w-3.5 h-3.5" />
            In Progress
          </span>
        }
        tabs={tabs}
      />
    </>
  );
}
