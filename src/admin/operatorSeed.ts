// Operator-side in-memory seed — MLG + Neeley as the two V1-pilot firms.
//
// Used by the Bankruptcy.AI Admin portal's Dashboard + Firm Registry
// surfaces so they render the expected firms even when the unauthenticated
// dev session can't satisfy RLS on the real `firms` table.
//
// SCAFFOLD ONLY — these counts + dates are placeholders. Real aggregates
// flow from:
//   - signup date       → firms.created_at
//   - cases_on_platform → COUNT(client_intakes) per firm
//   - cases_filed       → COUNT(client_intakes WHERE status = 'filed') per firm
//   - avgDaysToFile     → AVG(filed_at - intake_started_at) per firm
//   - servicePlanKey    → firm_service_plans.plan_key
// Marked TODO so the wiring layer is obvious.

export interface OperatorSeedFirm {
  id: string;
  name: string;
  slug: string;
  status: "lead" | "trial" | "active" | "suspended" | "churned";
  /** Firm signup date — ISO 8601. TODO: wire from real firms.created_at. */
  signupDate: string;
  /** Active intakes attached to the firm (Ch.7 + Ch.13 combined, any
   *  status). TODO: wire from real intake aggregate. */
  casesOnPlatform: number;
  /** Cases that have been filed with the court. TODO: wire from real
   *  client_intakes.status='filed' count. */
  casesFiled: number;
  /** Jurisdictions the firm is admitted to practice in. Used by
   *  firmPolicy.firmAdmittedStates as the per-firm seed when the
   *  localStorage value isn't set. TODO: wire from a real
   *  firms.admitted_states JSONB column once the firm-profile schema lands. */
  admittedStates: ReadonlyArray<string>;
  /** Average days from intake start → filed for this firm's CLOSED cases.
   *  PLACEHOLDER — derived from a small seed; real number comes from the
   *  aggregate query noted above. When both intake / filed timestamps
   *  exist in the seed below, computeFirmComparison prefers that derived
   *  value; otherwise it falls back to this static placeholder and tags
   *  the row with dataSource="seed_static". */
  avgDaysToFile?: number;
  /** Optional cohort avg dates — when both are present, comparison row
   *  computes (filed − intake) in days instead of trusting avgDaysToFile.
   *  TODO: replace with the real per-case duration aggregate. */
  intakeStartedAvgAt?: string;
  casesFiledAvgAt?: string;
  /** Service plan tier the firm is on — keys into SERVICE_PLANS below.
   *  PLACEHOLDER assignment for the operator billing roll-up. */
  servicePlanKey: ServicePlanKey;
  /** ISO date the firm was assigned (or moved to) the current plan.
   *  Used by the billing table to show "since". */
  planAssignedAt: string;
}

// ─── Service plans ────────────────────────────────────────────────────────
//
// PLACEHOLDER tier names + prices for the operator billing surface.
// Dom sets the actual catalog before any real billing wiring; do NOT
// present these numbers as the final pricing. They exist so the
// roll-up + utilization columns have something to render against.
//
// Real billing (invoicing, dunning, Stripe customer / subscription /
// usage records) is V2+ and out of scope here.

export type ServicePlanKey = "solo" | "growth" | "scale";

export interface ServicePlan {
  key: ServicePlanKey;
  /** PLACEHOLDER display name. */
  name: string;
  /** PLACEHOLDER monthly price in USD cents. */
  monthlyPriceCents: number;
  /** Cases included in the base monthly price. 0 = unlimited (seat-based
   *  plans). PLACEHOLDER. */
  includedCases: number;
  /** Brief scope blurb — what's included at this tier. PLACEHOLDER copy. */
  scope: string;
}

export const SERVICE_PLANS: ReadonlyArray<ServicePlan> = [
  {
    key:               "solo",
    name:              "Solo (placeholder)",
    monthlyPriceCents: 19900,
    includedCases:     10,
    scope:             "Single-attorney firms. Ch.7 + Ch.13 intake + signing review. PLACEHOLDER scope.",
  },
  {
    key:               "growth",
    name:              "Growth (placeholder)",
    monthlyPriceCents: 49900,
    includedCases:     40,
    scope:             "Small firms. Adds attorney-review queues + multi-staff dashboards. PLACEHOLDER scope.",
  },
  {
    key:               "scale",
    name:              "Scale (placeholder)",
    monthlyPriceCents: 99900,
    includedCases:     0, // unlimited at this placeholder tier
    scope:             "Multi-office firms. Unlimited cases + priority operator support. PLACEHOLDER scope.",
  },
];

export function findServicePlan(key: ServicePlanKey): ServicePlan {
  const plan = SERVICE_PLANS.find(p => p.key === key);
  // SERVICE_PLANS is a closed catalog; the union guarantees this never
  // misses — the throw is purely a "future-proof" guard for new keys.
  if (!plan) throw new Error(`Unknown service plan: ${key}`);
  return plan;
}

// ─── Firm seed ────────────────────────────────────────────────────────────

export const OPERATOR_SEED_FIRMS: ReadonlyArray<OperatorSeedFirm> = [
  {
    id:                 "00000000-0000-0000-0000-000000000001",
    name:               "Majors Law Group",
    slug:               "majors-law-group",
    status:             "active",
    signupDate:         "2025-09-01",
    casesOnPlatform:    47,
    casesFiled:         19,
    admittedStates:     ["Arizona", "Washington"],
    avgDaysToFile:      52,
    intakeStartedAvgAt: "2025-11-12",
    casesFiledAvgAt:    "2026-01-03",
    servicePlanKey:     "growth",
    planAssignedAt:     "2025-09-01",
  },
  {
    id:                 "00000000-0000-0000-0000-000000000002",
    name:               "Neeley Law",
    slug:               "neeley-law",
    status:             "active",
    signupDate:         "2025-10-15",
    casesOnPlatform:    22,
    casesFiled:         8,
    admittedStates:     ["Arizona"],
    avgDaysToFile:      61,
    intakeStartedAvgAt: "2025-12-01",
    casesFiledAvgAt:    "2026-01-31",
    servicePlanKey:     "solo",
    planAssignedAt:     "2025-10-15",
  },
];

/** Aggregate metrics derived from the seed. Same return shape will be
 *  populated by the real-data query when persistence lands. */
export interface OperatorMetrics {
  totalFirms: number;
  casesOnPlatform: number;
  casesFiled: number;
}

export function computeOperatorMetrics(firms: ReadonlyArray<OperatorSeedFirm>): OperatorMetrics {
  return {
    totalFirms:      firms.length,
    casesOnPlatform: firms.reduce((acc, f) => acc + f.casesOnPlatform, 0),
    casesFiled:      firms.reduce((acc, f) => acc + f.casesFiled, 0),
  };
}

// ─── Slice 3 — Firm comparison reporting ──────────────────────────────────

/** Per-firm row for the cross-firm comparison table. Derived in one
 *  place so both the comparison view and any downstream surface (e.g. an
 *  export) read the same numbers. */
export interface FirmComparisonRow {
  firmId: string;
  firmName: string;
  status: OperatorSeedFirm["status"];
  totalCases: number;
  filedCases: number;
  /** Filed / total, expressed as a 0–100 percentage. 0 when totalCases=0
   *  (rather than NaN). */
  filingRatePct: number;
  /** Average days from intake start → filed. null when neither the
   *  derived date pair nor the static placeholder is available. */
  avgDaysToFile: number | null;
  /** Provenance flag — "derived" when computed from the per-firm date
   *  pair (intakeStartedAvgAt + casesFiledAvgAt); "seed_static" when
   *  falling back to the static avgDaysToFile placeholder; "none" when
   *  neither is available. The comparison UI renders an "approx" tag for
   *  the latter two so the operator doesn't read placeholder numbers as
   *  authoritative. */
  avgDaysSource: "derived" | "seed_static" | "none";
}

export function computeFirmComparison(
  firms: ReadonlyArray<OperatorSeedFirm>,
): FirmComparisonRow[] {
  return firms.map(f => {
    const filingRatePct = f.casesOnPlatform > 0
      ? Math.round((f.casesFiled / f.casesOnPlatform) * 1000) / 10
      : 0;
    let avgDaysToFile: number | null = null;
    let avgDaysSource: FirmComparisonRow["avgDaysSource"] = "none";
    if (f.intakeStartedAvgAt && f.casesFiledAvgAt) {
      const intake = Date.parse(f.intakeStartedAvgAt);
      const filed = Date.parse(f.casesFiledAvgAt);
      if (Number.isFinite(intake) && Number.isFinite(filed) && filed >= intake) {
        avgDaysToFile = Math.round((filed - intake) / (1000 * 60 * 60 * 24));
        avgDaysSource = "derived";
      }
    }
    if (avgDaysToFile == null && typeof f.avgDaysToFile === "number" && f.avgDaysToFile >= 0) {
      avgDaysToFile = f.avgDaysToFile;
      avgDaysSource = "seed_static";
    }
    return {
      firmId:        f.id,
      firmName:      f.name,
      status:        f.status,
      totalCases:    f.casesOnPlatform,
      filedCases:    f.casesFiled,
      filingRatePct,
      avgDaysToFile,
      avgDaysSource,
    };
  });
}

// ─── Slice 4 — Per-firm billing roll-up ───────────────────────────────────

/** Per-firm billing row. Monthly charge = the plan's flat
 *  monthlyPriceCents. Usage-based overage isn't modeled at this
 *  scaffold — the prompt explicitly defers real billing wiring to V2+. */
export interface FirmBillingRow {
  firmId: string;
  firmName: string;
  status: OperatorSeedFirm["status"];
  plan: ServicePlan;
  planAssignedAt: string;
  /** Cases used this period — for the scaffold, == casesOnPlatform. */
  casesUsed: number;
  /** Utilization vs plan's includedCases. null when includedCases=0
   *  (unlimited tier) so the UI can render "—" instead of ∞. */
  utilizationPct: number | null;
  /** Plan's monthlyPriceCents. Surfaced separately so the roll-up sums
   *  this directly rather than re-fetching plan rows. */
  monthlyChargeCents: number;
}

export interface OperatorBillingRollUp {
  rows: FirmBillingRow[];
  /** Active firms only — suspended / churned don't bill. */
  activeFirmCount: number;
  /** Sum of monthlyChargeCents across active firms. */
  totalMonthlyCents: number;
  /** Sum across active firms only — same value as totalMonthlyCents,
   *  exposed separately to make the "MRR-style" framing explicit at the
   *  consumer. */
  mrrCents: number;
}

const BILLABLE_STATUSES: ReadonlySet<OperatorSeedFirm["status"]> = new Set([
  "trial",
  "active",
]);

export function computeFirmBilling(
  firms: ReadonlyArray<OperatorSeedFirm>,
): OperatorBillingRollUp {
  const rows = firms.map<FirmBillingRow>(f => {
    const plan = findServicePlan(f.servicePlanKey);
    const utilizationPct = plan.includedCases > 0
      ? Math.round((f.casesOnPlatform / plan.includedCases) * 1000) / 10
      : null;
    return {
      firmId:             f.id,
      firmName:           f.name,
      status:             f.status,
      plan,
      planAssignedAt:     f.planAssignedAt,
      casesUsed:          f.casesOnPlatform,
      utilizationPct,
      monthlyChargeCents: plan.monthlyPriceCents,
    };
  });
  const billable = rows.filter(r => BILLABLE_STATUSES.has(r.status));
  const totalMonthlyCents = billable.reduce(
    (acc, r) => acc + r.monthlyChargeCents, 0,
  );
  return {
    rows,
    activeFirmCount:   billable.length,
    totalMonthlyCents,
    mrrCents:          totalMonthlyCents,
  };
}

// ─── Live + seed merge ────────────────────────────────────────────────────

/** Merge live Supabase firms (when available) with the seed so the operator
 *  surface stays populated in dev. Live firms WIN on id collision — seed
 *  only fills gaps. */
export function mergeSeedWithLive<T extends { id: string }>(
  live: ReadonlyArray<T>,
  seed: ReadonlyArray<OperatorSeedFirm>,
): Array<T | OperatorSeedFirm> {
  const seenIds = new Set(live.map(f => f.id));
  const fillers = seed.filter(s => !seenIds.has(s.id));
  return [...live, ...fillers];
}
