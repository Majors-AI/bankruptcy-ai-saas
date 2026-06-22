// Lead lifecycle — the normalized 8-state progression for every intake lead.
//
// Status values:
//   new              — Lead just created; first contact owed.
//   contacted        — Initial contact made (call/text/email/in-person);
//                      awaiting client response or follow-up.
//   in_intake        — Intake interview in progress (any mode: live chat,
//                      email interview, self-serve questionnaire, scheduled
//                      consult); not yet qualified.
//   qualified        — Intake complete and screening criteria met (firm
//                      can accept this case); awaiting client decision /
//                      attorney case review.
//   converted        — Client signed engagement / retainer; this is the
//                      conversion point. The lead is now a client; case
//                      proceeds.
//   handoff_to_legal — Converted lead has been formally handed to Legal
//                      (matter intake opened, attorney assigned). Mirrors
//                      the existing `submitted_for_review` / paralegal-
//                      review entry point.
//   disqualified     — Terminal: firm cannot or chose not to take the case
//                      (eligibility, conflict, jurisdiction, capacity).
//   lost             — Terminal: lead went cold or chose another firm.
//
// The two terminal states `disqualified` and `lost` end the timeline
// early (Change 7 — the unified file timeline closes the stepper).
//
// This module is the SINGLE source of truth for the lifecycle. Schema-side,
// see docs/schema-changes-for-canelo.md §1 (new column
// `intake_leads.lifecycle_status` + CHECK constraint). Until that column
// lands, the frontend reads the new value when present and falls back to
// the legacy free-text `status` column mapped via `STATUS_TO_LIFECYCLE`
// below.

export const LIFECYCLE_STATUSES = [
  "new",
  "contacted",
  "in_intake",
  "qualified",
  "converted",
  "handoff_to_legal",
  "disqualified",
  "lost",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const TERMINAL_LIFECYCLE_STATUSES: ReadonlySet<LifecycleStatus> = new Set([
  "disqualified",
  "lost",
]);

/** Active (non-terminal) statuses, in the order they advance through. */
export const ACTIVE_LIFECYCLE_ORDER: ReadonlyArray<LifecycleStatus> = [
  "new",
  "contacted",
  "in_intake",
  "qualified",
  "converted",
  "handoff_to_legal",
];

/** Display labels — used by the Intake board, the file timeline (Change 7),
 *  and the lead-detail header. */
export const LIFECYCLE_LABELS: Readonly<Record<LifecycleStatus, string>> = {
  new:              "New",
  contacted:        "Contacted",
  in_intake:        "In intake",
  qualified:        "Qualified",
  converted:        "Converted",
  handoff_to_legal: "Handed off to Legal",
  disqualified:     "Disqualified",
  lost:             "Lost",
};

/** Short descriptive blurbs for the status — used as tooltips / row hints. */
export const LIFECYCLE_DESCRIPTIONS: Readonly<Record<LifecycleStatus, string>> = {
  new:              "Lead just created; first contact owed.",
  contacted:        "Initial contact made; awaiting reply or follow-up.",
  in_intake:        "Intake interview in progress (any mode).",
  qualified:        "Intake complete and screening criteria met; awaiting attorney case review or client decision.",
  converted:        "Client signed engagement; case proceeds.",
  handoff_to_legal: "Matter intake opened with Legal; attorney assigned.",
  disqualified:     "Firm cannot or chose not to take the case.",
  lost:             "Lead went cold or chose another firm.",
};

/** True when the given status is terminal (timeline closes here). */
export function isTerminalLifecycle(status: LifecycleStatus | null | undefined): boolean {
  return !!status && TERMINAL_LIFECYCLE_STATUSES.has(status);
}

/** Type-guard for arbitrary string → LifecycleStatus. */
export function isLifecycleStatus(v: unknown): v is LifecycleStatus {
  return typeof v === "string" && (LIFECYCLE_STATUSES as ReadonlyArray<string>).includes(v);
}

/** RUNTIME fallback for legacy `intake_leads.status` free-text values →
 *  normalized lifecycle. Keys are lowercased / trimmed before lookup.
 *
 *  This table is the RUNTIME path used by the frontend between deploy
 *  and Canelo's one-time backfill landing — it lets `resolveLifecycle()`
 *  return something sensible for legacy rows that don't yet carry
 *  `lifecycle_status`. It is also a STARTING SKETCH for the production
 *  backfill mapping, NOT the final mapping.
 *
 *  **The production backfill (docs/schema-changes-for-canelo.md §1)
 *  does NOT silently default unknown historical statuses to `'new'`.**
 *  Per Dom's call (2026-06-19), Canelo first runs
 *    `SELECT DISTINCT status, COUNT(*) FROM intake_leads
 *      GROUP BY status ORDER BY 2 DESC;`
 *  then Dom + Claude review every real value and produce an explicit
 *  mapping (especially `'retained'` → `converted`/`handoff_to_legal`,
 *  `'no_show'` → `lost`). Anything unresolved escalates to Dom — the
 *  migration does not proceed with an unreviewed fallback.
 *
 *  Known legacy values seen in the codebase (per the intake new-lead
 *  default at LegalAdminPortal.tsx:259 and the contact-log outcomes
 *  throughout):
 *    - "new"           — initial state on lead creation
 *    - "contacted"     — set by outbound-contact flows
 *    - "in_intake"     — set when the questionnaire opens
 *    - "qualified"     — historical; same shape as new lifecycle
 *    - "converted"     — historical; client signed
 *    - "retained"      — historical synonym for converted (review with Dom)
 *    - "no_show"       — terminal; maps to lost
 *    - "lost"          — historical
 *
 *  Runtime fallback for any string NOT in this table: `'new'` (so the UI
 *  doesn't crash on a row with an unrecognized legacy value). The
 *  production backfill does NOT use this fallback.
 */
const STATUS_TO_LIFECYCLE_RAW: Readonly<Record<string, LifecycleStatus>> = {
  // Identity passthrough — already-normalized values.
  new:                "new",
  contacted:          "contacted",
  in_intake:          "in_intake",
  "in-intake":        "in_intake",
  qualified:          "qualified",
  converted:          "converted",
  handoff_to_legal:   "handoff_to_legal",
  "handoff-to-legal": "handoff_to_legal",
  disqualified:       "disqualified",
  lost:               "lost",
  // Legacy / common-language synonyms encountered in the existing schema:
  "first contact":    "new",
  "no answer":        "contacted",
  scheduled:          "contacted",       // appointment booked counts as contacted
  "intake started":   "in_intake",
  "intake complete":  "in_intake",       // not yet qualified; attorney review pending
  retained:           "converted",
  signed:             "converted",
  "in legal":         "handoff_to_legal",
  "in_legal":         "handoff_to_legal",
  declined:           "disqualified",
  "no_show":          "lost",
  "no-show":          "lost",
  cold:               "lost",
};

/** Coerce a legacy `intake_leads.status` string into the normalized
 *  lifecycle. Trims + lowercases + strips internal whitespace runs to a
 *  single space before lookup. Unknown values → `'new'` (matches the
 *  Canelo-side backfill spec).
 *
 *  Caller convention: prefer reading `intake_leads.lifecycle_status`
 *  directly. Use this only when the new column is null / missing (legacy
 *  rows before the migration lands, or rows from a pre-deploy worker). */
export function legacyStatusToLifecycle(legacy: string | null | undefined): LifecycleStatus {
  if (!legacy) return "new";
  const key = String(legacy).trim().toLowerCase().replace(/\s+/g, " ");
  return STATUS_TO_LIFECYCLE_RAW[key] ?? "new";
}

/** Resolve a lead's effective lifecycle. Prefers the new column; falls back
 *  to the legacy `status` text. Pure read — never writes. */
export function resolveLifecycle(lead: {
  lifecycle_status?: string | null;
  status?: string | null;
}): LifecycleStatus {
  if (lead.lifecycle_status && isLifecycleStatus(lead.lifecycle_status)) {
    return lead.lifecycle_status;
  }
  return legacyStatusToLifecycle(lead.status);
}

// ─── Lead intake channel ────────────────────────────────────────────────────
//
// The structured entry-mode column (`intake_leads.channel`, see
// docs/schema-changes-for-canelo.md §1). Separate from the free-text
// `source` column the existing schema already has (which stores
// marketing-source / referrer values).

export const LEAD_CHANNELS = [
  "call_now",
  "live_chat",
  "sms",
  "scheduled",
  "self_serve",
  "agent_assisted",
] as const;

export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const LEAD_CHANNEL_LABELS: Readonly<Record<LeadChannel, string>> = {
  call_now:       "Call now",
  live_chat:      "Live chat",
  sms:            "Text message",
  scheduled:      "Scheduled consult",
  self_serve:     "Self-serve",
  agent_assisted: "Email interview",
};

export function isLeadChannel(v: unknown): v is LeadChannel {
  return typeof v === "string" && (LEAD_CHANNELS as ReadonlyArray<string>).includes(v);
}
