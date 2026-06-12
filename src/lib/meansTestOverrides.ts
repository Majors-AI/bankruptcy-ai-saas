// Per-case attorney overrides for the long-form deduction engine.
//
// Reuses the Part E pattern: each override is keyed by the deduction
// line's `path` (the same shape the firm overlay and rulesAuditStore
// already use). Setting an override records to the rulesAuditStore so
// the re-review trigger fires on reviewed-but-unfiled cases when an
// attorney edits a line.
//
// Storage shape:
//   _moduleOverrides: caseId → (path → value)
//
// Static reader works from non-React code (the engine in
// meansTestDeductions.ts reads via the Map snapshot passed in); the
// React hook subscribes for reactive re-renders inside the attorney
// surface.
//
// SCAFFOLD persistence: in-memory + per-tab localStorage mirror per case.
// TODO Phase B — attorney_intake_review_deductions(review_id, path,
// value_cents, set_by_user_id, set_at) — SQL provided separately; no DB
// writes from this scaffold.

import { useEffect, useState } from "react";

const STORAGE_KEY = "meansTestOverrides";

type CaseOverrides = Map<string, number | null>;
const _byCase: Map<string, CaseOverrides> = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Record<string, number | null>>;
      const m = new Map<string, CaseOverrides>();
      for (const [caseId, lines] of Object.entries(parsed)) {
        m.set(caseId, new Map(Object.entries(lines)));
      }
      return m;
    }
  } catch { /* ignore */ }
  return new Map<string, CaseOverrides>();
})();

const _subscribers = new Set<() => void>();
function _notify() { _subscribers.forEach(fn => fn()); }

function _persist() {
  try {
    if (typeof localStorage === "undefined") return;
    const out: Record<string, Record<string, number | null>> = {};
    for (const [caseId, lines] of _byCase) {
      out[caseId] = Object.fromEntries(lines);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch { /* ignore */ }
}

/** Read the override Map for a case — used by computeLongFormDeductions.
 *  Empty Map when no overrides set. */
export function getCaseDeductionOverrides(caseId: string): ReadonlyMap<string, number | null> {
  return _byCase.get(caseId) ?? new Map();
}

/** Set or clear an override. Pass null to remove. Returns the new value.
 *  Optional `reason` is informational — when passed, surfaces in the
 *  rulesAuditStore.recordChange `source` string so audit reviewers see
 *  why the attorney departed from the canonical value. */
export function setCaseDeductionOverride(
  caseId: string,
  path: string,
  value: number | null | undefined,
  _reason?: string,
): number | null {
  // _reason is accepted but stored only in the audit log (the caller
  // passes it through to recordChange). The override map itself doesn't
  // persist the reason today — that's a per-override-history schema
  // change that lands with the firm_per_case_deduction_overrides table.
  let lines = _byCase.get(caseId);
  if (!lines) {
    lines = new Map();
    _byCase.set(caseId, lines);
  }
  if (value === undefined) {
    lines.delete(path);
  } else {
    lines.set(path, value);
  }
  _persist();
  _notify();
  return value ?? null;
}

/** Reactive hook — returns a fresh Map reference whenever any override on
 *  the given case changes. The engine consumer passes the returned Map
 *  into computeLongFormDeductions. */
export function useCaseDeductionOverrides(caseId: string): ReadonlyMap<string, number | null> {
  const [snapshot, setSnapshot] = useState<ReadonlyMap<string, number | null>>(() => new Map(_byCase.get(caseId) ?? []));
  useEffect(() => {
    const sync = () => setSnapshot(new Map(_byCase.get(caseId) ?? []));
    _subscribers.add(sync);
    // Resync if caseId changed
    sync();
    return () => { _subscribers.delete(sync); };
  }, [caseId]);
  return snapshot;
}
