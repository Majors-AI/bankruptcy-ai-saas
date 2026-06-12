// Rule-change requests — any role submits {section, value/row, issue,
// suggested correction}; firm attorneys + platform operators action them.
//
// In-memory + per-tab localStorage today. TODO Phase B —
// firm_rule_change_requests(firm_id, section, row_key, issue,
// suggestion, status, submitted_by, submitted_at, actioned_by,
// actioned_at) + email routing to firm attorney/admin (when the firm
// submits) and to the platform operator (when needed).

import { useEffect, useState } from "react";

/** Sections that can be flagged. Mirrors the rulesAuditStore RulesSection
 *  union plus the lower-cardinality entries (Local Rules, sub-sections
 *  inside Living Standards, Means-Test Figures catalog). Stored as a
 *  string so the union expands without churning the store type. */
export type RuleChangeSection =
  | "median_income"
  | "exemptions"
  | "living_standards.national"
  | "living_standards.housing"
  | "living_standards.transportation"
  | "means_test_figures"
  | "local_rules";

export const RULE_CHANGE_SECTION_LABEL: Readonly<Record<RuleChangeSection, string>> = {
  median_income:                    "Median Income",
  exemptions:                       "Bankruptcy Exemptions",
  "living_standards.national":      "Living Standards — National Standards",
  "living_standards.housing":       "Living Standards — Housing & Utilities",
  "living_standards.transportation": "Living Standards — Transportation",
  means_test_figures:               "Means-Test Figures",
  local_rules:                      "Local Rules",
};

export interface RuleChangeRequest {
  id: string;
  section: RuleChangeSection;
  /** The row or value the requester is flagging (e.g. "AZ size-4 median",
   *  "WA — Pierce County housing size-3", "Form 122A-1 line 17a"). Free-form. */
  rowKey: string;
  /** What's wrong. */
  issue: string;
  /** Proposed correction (value, citation, etc.). */
  suggestion: string;
  /** Who submitted. Free-form name string until auth context lands. */
  submittedBy: string;
  /** ISO timestamp. */
  submittedAt: string;
  /** Lifecycle. */
  status: "pending" | "accepted" | "rejected";
}

const STORAGE_KEY = "ruleChangeRequests";

let _requests: RuleChangeRequest[] = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as RuleChangeRequest[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
})();

const _subscribers = new Set<() => void>();
function _notify() { _subscribers.forEach(fn => fn()); }
function _persist() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_requests));
  } catch { /* ignore */ }
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export interface SubmitRuleChangeRequestInput {
  section: RuleChangeSection;
  rowKey: string;
  issue: string;
  suggestion: string;
  submittedBy: string;
}

/** Submit a new change request. Returns the created record. TODO: persist
 *  + route to firm attorney/admin and to the platform operator. */
export function submitRuleChangeRequest(input: SubmitRuleChangeRequestInput): RuleChangeRequest {
  const rec: RuleChangeRequest = {
    id:           uid("rcr"),
    section:      input.section,
    rowKey:       input.rowKey.trim(),
    issue:        input.issue.trim(),
    suggestion:   input.suggestion.trim(),
    submittedBy:  input.submittedBy.trim() || "unknown",
    submittedAt:  new Date().toISOString(),
    status:       "pending",
  };
  _requests = [rec, ..._requests];
  _persist();
  _notify();
  return rec;
}

/** Read all requests; optional section filter. */
export function getRuleChangeRequests(section?: RuleChangeSection): ReadonlyArray<RuleChangeRequest> {
  if (!section) return _requests;
  return _requests.filter(r => r.section === section);
}

/** Reactive hook — count of pending requests for a section. Powers the
 *  "N pending" chip next to the Request-Change button. */
export function useRuleChangeRequestCount(section: RuleChangeSection): number {
  const [n, setN] = useState<number>(() => _requests.filter(r => r.section === section && r.status === "pending").length);
  useEffect(() => {
    const sync = () => setN(_requests.filter(r => r.section === section && r.status === "pending").length);
    _subscribers.add(sync);
    sync();
    return () => { _subscribers.delete(sync); };
  }, [section]);
  return n;
}
