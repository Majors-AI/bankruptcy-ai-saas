// Lead-locking scaffold — "Now being handled by {staff name}".
//
// PURPOSE
// Two staffers shouldn't work the same lead at the same time. This module
// provides the UI surface for the lock: a badge that appears on lead rows
// claimed by someone else, a banner inside the lead detail surface, and a
// reusable `isClaimedByOther` predicate that gates click-to-open routes.
//
// SCOPE OF THIS BUILD
// SCAFFOLD ONLY — read-path. No DB writes, no migration, no realtime channel.
// The optional `claimed_by` / `claimed_by_name` / `claimed_at` fields are
// read from the lead row if present; they're null today because the column
// doesn't exist yet, so the gate is a no-op in production until the schema
// lands. Build everything as if the field works — once the migration ships,
// every surface in this module starts enforcing the lock automatically.
//
// TODO Phase B — what's needed to make this real:
//   1. Schema: ALTER TABLE intake_leads ADD COLUMN
//        claimed_by uuid REFERENCES staff_members(id),
//        claimed_by_name text,
//        claimed_at timestamptz.
//      Drop existing claim with `claimed_by IS NULL`; expire stale claims
//      (e.g., > 30 min idle) via a trigger or scheduled function.
//   2. Claim mutation: a `claim_lead(p_lead_id, p_staff_id)` RPC that
//      conditionally writes claimed_by/claimed_at ONLY IF currently null
//      OR already-claimed-by-this-staffer OR claim is stale. Returns the
//      effective claim row.
//   3. Release mutation: `release_lead(p_lead_id, p_staff_id)` clears the
//      claim if the caller owns it.
//   4. Supabase Realtime: subscribe each portal client to
//      `intake_leads` row updates so the badge appears LIVE the moment a
//      teammate claims a lead. Without realtime the lock only refreshes on
//      page-level reloads (acceptable as a v0).
//   5. UX on the LeadDetailPanel: an explicit "Claim" / "Release" pill so a
//      staffer can hand off; if a staffer opens a stale claim, offer to
//      take it over with one tap.

import type { ReactNode } from "react";
import { UserCheck, Users } from "lucide-react";

/**
 * Optional claim fields on the lead row. Mixed into the existing Lead types
 * in LegalAdminPortal + IntakeDashboard as optional members. Until the
 * column lands these are always undefined / null in practice — the helper
 * below tolerates that gracefully.
 */
export interface LeadClaimFields {
  claimed_by?: string | null;
  claimed_by_name?: string | null;
  claimed_at?: string | null;
}

/**
 * True when the lead carries a claim AND the claim belongs to someone other
 * than the current staffer. Tolerates leads that don't have the column yet
 * (claimed_by undefined) — returns false so existing flows aren't blocked.
 */
export function isClaimedByOther(
  lead: LeadClaimFields | null | undefined,
  currentSessionId: string | null | undefined,
): boolean {
  if (!lead) return false;
  if (!lead.claimed_by) return false;
  if (!currentSessionId) return true; // safer default: treat unknown viewer as "other"
  return lead.claimed_by !== currentSessionId;
}

/**
 * Inline pill shown next to a lead's name on rows + cards. Renders nothing
 * when the lead isn't claimed by someone else.
 */
export function LeadClaimBadge({
  lead, currentSessionId, size = "sm",
}: {
  lead: LeadClaimFields | null | undefined;
  currentSessionId: string | null | undefined;
  size?: "xs" | "sm";
}) {
  if (!isClaimedByOther(lead, currentSessionId)) return null;
  const name = lead!.claimed_by_name ?? "another staffer";
  const sz =
    size === "xs"
      ? "text-[9px] px-1.5 py-0.5 gap-1"
      : "text-[10px] px-2 py-0.5 gap-1";
  return (
    <span
      className={`inline-flex items-center ${sz} font-semibold uppercase tracking-widest rounded border border-amber-700/60 bg-amber-900/30 text-amber-200`}
      title={`Locked — being handled by ${name}`}
    >
      <UserCheck className="w-3 h-3" />
      Handled by {name}
    </span>
  );
}

/**
 * Full-width banner for the lead detail surface — only renders when another
 * staffer holds the claim. Use this as a safety net inside the detail panel
 * itself, in case any open-path bypasses the requestOpenLead gate.
 */
export function LeadClaimBanner({
  lead, currentSessionId, extra,
}: {
  lead: LeadClaimFields | null | undefined;
  currentSessionId: string | null | undefined;
  /** Optional trailing content (e.g. a "Take it over" stub button). */
  extra?: ReactNode;
}) {
  if (!isClaimedByOther(lead, currentSessionId)) return null;
  const name = lead!.claimed_by_name ?? "another staffer";
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <Users className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-200">
          Now being handled by {name}
        </p>
        <p className="text-[11px] text-amber-200/80 mt-0.5 leading-snug">
          Read-only — another staffer claimed this lead. Coordinate before editing to avoid double-work.
        </p>
      </div>
      {extra}
    </div>
  );
}
