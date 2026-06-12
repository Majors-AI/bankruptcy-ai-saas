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
}

export const OPERATOR_SEED_FIRMS: ReadonlyArray<OperatorSeedFirm> = [
  {
    id:              "00000000-0000-0000-0000-000000000001",
    name:            "Majors Law Group",
    slug:            "majors-law-group",
    status:          "active",
    signupDate:      "2025-09-01",
    casesOnPlatform: 47,
    casesFiled:      19,
  },
  {
    id:              "00000000-0000-0000-0000-000000000002",
    name:            "Neeley Law",
    slug:            "neeley-law",
    status:          "active",
    signupDate:      "2025-10-15",
    casesOnPlatform: 22,
    casesFiled:      8,
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
