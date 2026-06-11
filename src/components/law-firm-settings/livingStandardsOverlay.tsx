// Living-standards firm overlay.
//
// IRS Living Standards (expense allowances) are the ONLY canonical
// legal-reference dataset firms may adjust. Every other dataset (National
// Standards / Median Income / Exemptions / means-test inputs / Local
// Rules) is READ-ONLY at the firm level — maintained by Bankruptcy.AI.
//
// Adjustment model: a firm raises/lowers a specific expense line WITHOUT
// touching canonical. The display always shows BOTH the canonical value
// and the firm-effective value alongside who/when. The path-keyed override
// map below is the firm delta on top of canonical; getEffective(path,
// canonical) returns the resolved value.
//
// Gate: ATTORNEY SUPERVISOR or ATTORNEY OWNER. Defined here as
//   (isLawyer) AND (department_supervisor OR law_firm_owner)
// reusing the existing LegalReferenceViewerRole enum:
//   - 'attorney_super_admin'  → lawyer + super_admin tier (acts as supervisor)
//   - 'law_firm_owner'        → owner (presumed lawyer)
// All others (legal_admin, plain attorney without supervisor rights,
// non-lawyer super_admin, department_supervisor without bar, none) →
// read-only.
//
// Audit + re-review: every override write calls into the existing
// rulesAuditStore.recordChange — same path-keyed audit log entry +
// edit-counter bump that drives the per-case re-review diff (no new
// mechanism). Filed/closed cases stay locked (handled by the existing
// rulesAuditStore.reReview derivation).
//
// SCAFFOLD persistence: overrides live in memory. TODO Phase B —
// firm_living_standards_overrides(firm_id, path, value, set_by_user_id,
// set_at, source_note) — SQL provided separately; no DB writes from this
// scaffold. The host can inject `initialOverrides` to bootstrap from a
// fetched row set when persistence wires up.

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { useRulesAudit } from "./rulesAuditStore";
import type { LegalReferenceViewerRole } from "../legal-reference/LegalReferenceStore";

// ─── Contract ──────────────────────────────────────────────────────────────

export interface LivingStandardsOverride {
  /** Dot-path identifying the canonical line being overridden — same shape
   *  as the rulesAuditStore.recordChange path argument so the audit log
   *  pivots on a stable key. Examples:
   *    "living_standards.national.food.size1"
   *    "living_standards.housing.AZ.Maricopa.size4"
   *    "living_standards.transportation.operating.Phoenix.one"
   */
  path: string;
  value: number | null;
  setBy: string;
  setAt: string;
  /** Optional firm note explaining the deviation (e.g. "high-cost ZIPs",
   *  "trustee position in this district"). Surfaced next to the override
   *  on read. */
  note?: string;
}

interface LivingStandardsOverlayState {
  /** path → most-recent override. */
  overrides: Record<string, LivingStandardsOverride>;
}

interface LivingStandardsOverlayApi extends LivingStandardsOverlayState {
  /** Whether the current viewer may set overrides. Reusing the existing
   *  LegalReferenceViewerRole — attorney_super_admin (lawyer supervisor)
   *  and law_firm_owner (lawyer owner) are the only "attorney supervisor
   *  / attorney owner" personas. */
  canAdjust: boolean;
  /** Resolve the effective value: override (if any) ?? canonical. Returns
   *  the canonical when no override exists. */
  getEffective(path: string, canonical: number | null): number | null;
  /** Pull just the override entry — UI uses this to render
   *  "canonical X / firm-adjusted Y (set by Z on D)". */
  getOverride(path: string): LivingStandardsOverride | null;
  /** Write/replace an override. Gated to attorney supervisor/owner;
   *  silently no-ops for non-authorized viewers (the calling button is
   *  also gated). Triggers the existing audit + re-review path. */
  setOverride(input: {
    path: string;
    value: number | null;
    canonical: number | null;
    note?: string;
  }): void;
  /** Drop the override for a path. Audit-logged. */
  clearOverride(path: string): void;
}

const Ctx = createContext<LivingStandardsOverlayApi | null>(null);

// ─── Role gate ─────────────────────────────────────────────────────────────
//
// "Attorney supervisor / attorney owner" — confirmed against the existing
// LegalReferenceViewerRole enum:
//   - attorney_super_admin = lawyer who is also super_admin tier
//                            (department/firm supervisor)
//   - law_firm_owner       = firm owner (presumed lawyer)
// These are the only two roles with attorney + supervisor/owner privileges.
// Non-lawyer super_admin, plain attorney, department_supervisor (non-bar),
// legal_admin, attorney, none → read-only on this overlay.
export function canAdjustLivingStandards(role: LegalReferenceViewerRole): boolean {
  return role === "attorney_super_admin" || role === "law_firm_owner";
}

// ─── Module-level singleton store ──────────────────────────────────────────
//
// The overlay is set inside LivingStandardsPage (Law Firm Settings), but the
// MEANS TEST runs inside LegalAdminPortal / AttorneyIntakeDashboard — a
// different provider tree. So an overlay set in one tree must be readable
// from the other. We hoist the storage to module scope and expose a static
// reader that any consumer (component or non-component) can call without
// being mounted under the React provider.
//
// The React provider still owns the role-gated write API + reactive subscription;
// it mirrors all writes to this module-level cache. When no provider has
// ever mounted, the cache is empty and the static reader returns canonical
// values (correct fallback).

const _moduleOverrides: Record<string, LivingStandardsOverride> = {};
const _moduleSubscribers = new Set<() => void>();
function _notifyOverlayChange() { _moduleSubscribers.forEach(fn => fn()); }

/** Static reader — works from anywhere (no provider required). Returns the
 *  effective living-standards value for `path`: the firm override if set,
 *  otherwise the canonical value passed in. Used by the means-test
 *  substitution in LegalAdminPortal so a firm's overlay actually flows
 *  into disposable-income and the §707(b) presumption check. */
export function getEffectiveLivingStandard(path: string, canonical: number | null): number | null {
  const override = _moduleOverrides[path];
  if (!override) return canonical;
  return override.value;
}

/** Read the override metadata (who/when) for a path. Used for tool-tip
 *  display next to means-test cells when an overlay is active. */
export function getLivingStandardsOverride(path: string): LivingStandardsOverride | null {
  return _moduleOverrides[path] ?? null;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function LivingStandardsOverlayProvider({
  children,
  viewerStaffRole,
  initialOverrides = {},
  actorName = "current_user",
}: {
  children: ReactNode;
  viewerStaffRole: LegalReferenceViewerRole;
  initialOverrides?: Record<string, LivingStandardsOverride>;
  /** Display name stamped onto setBy. Replace with the auth-bound user
   *  name when Supabase auth wires up. */
  actorName?: string;
}) {
  const audit = useRulesAudit();
  const [state, setState] = useState<LivingStandardsOverlayState>(() => {
    // Seed component state from initialOverrides AND mirror them into the
    // module-level cache so a fresh provider mount picks up any prior
    // writes from another provider tree in the same session.
    const seeded = { ...initialOverrides };
    for (const [path, v] of Object.entries(seeded)) {
      _moduleOverrides[path] = v;
    }
    return { overrides: { ..._moduleOverrides, ...seeded } };
  });

  const canAdjust = canAdjustLivingStandards(viewerStaffRole);

  const setOverride = useCallback<LivingStandardsOverlayApi["setOverride"]>(({ path, value, canonical, note }) => {
    if (!canAdjust) return;
    const entry: LivingStandardsOverride = { path, value, setBy: actorName, setAt: new Date().toISOString(), note };
    // Mirror to module-level cache FIRST so a non-React reader in the same
    // tick sees the new value.
    _moduleOverrides[path] = entry;
    _notifyOverlayChange();
    setState(prev => ({
      ...prev,
      overrides: { ...prev.overrides, [path]: entry },
    }));
    // Feed the existing audit + re-review mechanism. Living-standards
    // overrides bump the rulesAuditStore editCount → effective version
    // changes → in-window cases re-flagged.
    audit.recordChange({
      section: "living_standards",
      actor: actorName,
      path,
      oldValue: canonical,
      newValue: value,
      source: "firm overlay",
    });
    // TODO Phase B — persistence:
    //   - upsert into firm_living_standards_overrides keyed by (firm_id, path)
    //   - record actor + source_note + setAt
    //   - server-side enforcement: re-check canAdjustLivingStandards on
    //     INSERT/UPDATE via RLS so a tampered client cannot escape
  }, [canAdjust, audit, actorName]);

  const clearOverride = useCallback<LivingStandardsOverlayApi["clearOverride"]>((path) => {
    if (!canAdjust) return;
    const prevValue = _moduleOverrides[path]?.value ?? null;
    delete _moduleOverrides[path];
    _notifyOverlayChange();
    setState(prev => {
      const next = { ...prev.overrides };
      delete next[path];
      return { ...prev, overrides: next };
    });
    audit.recordChange({
      section: "living_standards",
      actor: actorName,
      path,
      oldValue: prevValue,
      newValue: null,
      source: "firm overlay cleared",
    });
  }, [canAdjust, audit, actorName]);

  // Subscribe to module-level overlay changes from other provider mounts
  // (e.g. an admin tab sets an override while a means-test surface is open).
  // This is a defensive sync; today only LivingStandardsPage writes.
  useEffect(() => {
    const sync = () => setState(prev => ({ ...prev, overrides: { ..._moduleOverrides } }));
    _moduleSubscribers.add(sync);
    return () => { _moduleSubscribers.delete(sync); };
  }, []);

  const getOverride = useCallback<LivingStandardsOverlayApi["getOverride"]>((path) => {
    return state.overrides[path] ?? null;
  }, [state.overrides]);

  const getEffective = useCallback<LivingStandardsOverlayApi["getEffective"]>((path, canonical) => {
    const override = state.overrides[path];
    if (!override) return canonical;
    return override.value;
  }, [state.overrides]);

  const api: LivingStandardsOverlayApi = useMemo(() => ({
    overrides: state.overrides,
    canAdjust,
    getEffective,
    getOverride,
    setOverride,
    clearOverride,
  }), [state.overrides, canAdjust, getEffective, getOverride, setOverride, clearOverride]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useLivingStandardsOverlay(): LivingStandardsOverlayApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLivingStandardsOverlay must be used inside LivingStandardsOverlayProvider");
  return v;
}
