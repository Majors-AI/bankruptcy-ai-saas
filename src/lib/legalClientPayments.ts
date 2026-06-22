// Legal-side payment view — typed interface + hook.
//
// Companion to functional-readme §15 (Payment View & BK Forms) and
// schema-changes-for-canelo.md §13 (v_legal_client_payments).
//
// THE HOOK IS UNWIRED TODAY. Per D1's UI-first build principle:
// (1) the typed contract ships now,
// (2) the UI consumer (<PaymentDataStrip>) renders honest empty /
//     "Not yet connected" states from the `unwired` status,
// (3) when Canelo's view lands, the implementation below swaps from
//     returning `{status: 'unwired'}` to issuing the Supabase query.
//     The UI consumer DOES NOT CHANGE.
//
// Never fabricate numbers. Every field has a corresponding empty-state
// branch in the consumer — see <PaymentDataStrip>.

// ── Status-tagged result type ──────────────────────────────────────────
//
// Every hook in src/lib/ exposes results in this shape per the readme's
// "honest empty/loading states" rule. Consumers MUST branch on `status`
// before reading `data`. Falling back to `data ?? defaultValue` hides
// the unwired condition and is forbidden.

export type HookStatus = "unwired" | "loading" | "empty" | "ready" | "error";

export interface HookResult<T> {
  status: HookStatus;
  data:   T | null;
  error:  string | null;
}

// ── Shape returned when wired ──────────────────────────────────────────

export interface LegalClientPaymentSummary {
  /** Lead spine id (per §3 / §12) — the matter key. */
  leadId: string;
  /** Display name on the client file. Sourced from intake_leads.full_name. */
  clientName: string;

  /** Cumulative non-voided attorney_fee + retainer payments. */
  amountPaidAttorneyFee: number;
  /** ISO timestamp when cumulative payments crossed
   *  accounting_fee_structures.attorney_fee. Null until that happens. */
  paidInFullAt: string | null;

  /** From accounting_fee_structures.cff_paid (boolean, direct). */
  filingFeePaid: boolean;
  /** ISO timestamp when the CFF flag flipped. Null if not paid. */
  filingFeePaidAt: string | null;

  /** True when any non-voided payment carries is_third_party=true. */
  hasThirdPartyPayer: boolean;
  /** Most-recent third-party payer name. Null when no third-party
   *  payments exist OR when the per-payment columns haven't shipped
   *  (S13.3 in schema-changes-for-canelo.md). */
  thirdPartyPayerName: string | null;

  /** Lifecycle / matter stage per §12 matter-spine columns. */
  lifecycleStatus:    string | null;
  matterProgression:  string | null;

  /** Read-only context for the BK forms (Disclosure of Compensation +
   *  SOFA Q.16). Display-only; never use to gate a workflow. */
  attorneyFeeAgreed:    number | null;
  courtFilingFeeAgreed: number | null;
  totalFeeAgreed:       number | null;
}

// ── Hook ────────────────────────────────────────────────────────────────

/** Read the §15 payment view for a single lead.
 *
 *  IMPLEMENTATION STATUS: unwired. Returns `{status: 'unwired', data: null,
 *  error: null}` regardless of input. The UI consumer treats this as
 *  "Not yet connected" and renders honest pending pills.
 *
 *  When schema-changes-for-canelo.md §13 lands (the v_legal_client_payments
 *  view + RLS), replace the body below with a Supabase query against the
 *  view. Map to LegalClientPaymentSummary; emit:
 *    - `{status: 'loading'}` while the request is in flight,
 *    - `{status: 'empty'}` when the query returns zero rows,
 *    - `{status: 'ready', data}` on success,
 *    - `{status: 'error', error}` on failure.
 *
 *  Callers MUST branch on status. `data ?? defaults` is forbidden. */
export function useLegalClientPayments(
  leadId: string | null | undefined,
): HookResult<LegalClientPaymentSummary> {
  // Defensive: no lead → no read.
  if (!leadId) {
    return { status: "empty", data: null, error: null };
  }
  // Unwired branch — see implementation-status comment above.
  return { status: "unwired", data: null, error: null };
}
