// Firm-policy bucket — settings the FIRM chooses for itself, separate from
// the canonical Reference Rules (national means-test inputs, IRS standards,
// median income, exemptions, local rules) maintained by Bankruptcy.AI.
//
// These knobs are firm-set and firm-local: they do NOT get pushed by an
// operator publish, they do NOT change the canonical version, and they
// are NOT statutory-canonical. They influence how the FIRM screens cases
// in its own intake, not the formal statutory math.
//
// Today's only knob:
//   - dmiTriageThresholdDollars: the firm's positive-DMI cutoff used to
//     route the intake triage between Ch.7 and Ch.13 attorney review.
//     Default $500. Adjustable by attorney supervisor / owner.
//
// IMPORTANT — this is intake triage, not the § 707(b)(2) statutory
// presumption. The statutory two-bracket presumption test (§ 707(b)(2)(A)(i)
// $9,075 / $15,150 brackets), the IRS-allowable long-form deductions on
// 122A-2 / 122C-2, and the commitment-period determination are SEPARATE
// evaluations — they will be the #6 / #7 build and are not configured
// here.
//
// SCAFFOLD persistence: state lives in memory + per-tab `localStorage`
// mirror so a refresh on the firm-policy page keeps the most recent value.
// TODO Phase B — firm_policy(firm_id, key, value_jsonb, set_by_user_id,
// set_at) — SQL provided separately; no DB writes from this scaffold.

import { useEffect, useState } from "react";

const STORAGE_KEY = "firmPolicy.dmiTriageThresholdDollars";
const DEFAULT_DMI_TRIAGE_THRESHOLD_DOLLARS = 500;

// Standard household-member contribution amount per jurisdiction (§
// 101(10A)(B)). Used by the attorney-side CMI surface when the
// contributor's actual contribution amount isn't broken out — the firm's
// default fill-in. AZ and WA defaults are $500 per the Part B spec.
const STORAGE_KEY_HC_AMOUNT = "firmPolicy.householdContributionAmountByState";
const DEFAULT_HOUSEHOLD_CONTRIBUTION_BY_STATE: Readonly<Record<string, number>> = {
  AZ: 500,
  WA: 500,
};

// Household-contribution treatment — firm-interpretation knob for how
// non-debtor household contributions enter CMI. The §101(10A)(B) statute
// is ambiguous across districts on what counts as "regular contribution";
// this knob captures the firm's working interpretation.
//
//   - 'include_all_recurring'     → every recurring contribution counts
//   - 'include_recurring_non_ss'  → exclude SS-sourced (matches our
//                                   cmi.ts default behavior)
//   - 'attorney_per_case'         → no automatic inclusion; attorney
//                                   adds per case
const STORAGE_KEY_HC_TREATMENT = "firmPolicy.householdContributionTreatment";
export type HouseholdContributionTreatment =
  | "include_all_recurring"
  | "include_recurring_non_ss"
  | "attorney_per_case";
const DEFAULT_HC_TREATMENT: HouseholdContributionTreatment = "include_recurring_non_ss";

// Minimum total debt the firm will accept a case at. Below this the
// intake screen raises an attorney-review Issue ("Total debt $X below
// firm minimum $8,500 — review case acceptance"). Non-blocking; firm
// still accepts the case if the attorney decides to.
const STORAGE_KEY_MIN_DEBT = "firmPolicy.minimumDebtThresholdDollars";
const DEFAULT_MIN_DEBT_THRESHOLD_DOLLARS = 8500;

// ─── Module-level singleton ────────────────────────────────────────────────
//
// Mirrors the living-standards-overlay pattern: state lives in module
// scope so non-React readers (e.g. the LegalAdminPortal intake screen)
// see the same value React consumers see. The hook subscribes for
// reactive re-renders.

let _dmiTriageThresholdDollars: number = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw != null) {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch { /* localStorage unavailable — fall through to default */ }
  return DEFAULT_DMI_TRIAGE_THRESHOLD_DOLLARS;
})();

const _subscribers = new Set<() => void>();
function _notify() { _subscribers.forEach(fn => fn()); }

/** Read the current firm DMI-triage threshold in DOLLARS. Static reader —
 *  callable from anywhere (React or not). Returns the firm-set value, or
 *  the default $500 when nothing has been set this session. */
export function getFirmDmiTriageThreshold(): number {
  return _dmiTriageThresholdDollars;
}

/** The default — exported so the Firm Policy UI can offer a "reset to default"
 *  button + display "(default)" affordance. */
export function getFirmDmiTriageThresholdDefault(): number {
  return DEFAULT_DMI_TRIAGE_THRESHOLD_DOLLARS;
}

/** Write the firm DMI-triage threshold. Gated upstream — the Firm Policy
 *  UI only shows the editor for attorney_super_admin / law_firm_owner.
 *  Mirrored to localStorage so a refresh keeps the value. TODO Phase B —
 *  upsert into firm_policy server-side + audit. */
export function setFirmDmiTriageThreshold(dollars: number): void {
  if (!Number.isFinite(dollars) || dollars < 0) return;
  _dmiTriageThresholdDollars = dollars;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(dollars));
    }
  } catch { /* ignore */ }
  _notify();
}

/** Reactive hook — Firm Policy editor + any consumer that needs to re-render
 *  when the threshold changes. Non-React callers should use
 *  getFirmDmiTriageThreshold() instead. */
export function useFirmDmiTriageThreshold(): number {
  const [v, setV] = useState<number>(_dmiTriageThresholdDollars);
  useEffect(() => {
    const sync = () => setV(_dmiTriageThresholdDollars);
    _subscribers.add(sync);
    return () => { _subscribers.delete(sync); };
  }, []);
  return v;
}

// ─── Household contribution amount (per-jurisdiction default) ───────────────

let _householdContributionByState: Record<string, number> = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_HC_AMOUNT) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const next: Record<string, number> = { ...DEFAULT_HOUSEHOLD_CONTRIBUTION_BY_STATE };
        for (const [k, v] of Object.entries(parsed)) {
          const n = parseFloat(String(v));
          if (Number.isFinite(n) && n >= 0) next[k.toUpperCase()] = n;
        }
        return next;
      }
    }
  } catch { /* localStorage unavailable / parse error — fall through */ }
  return { ...DEFAULT_HOUSEHOLD_CONTRIBUTION_BY_STATE };
})();

/** Default standard contribution amount for a state. Falls back to the
 *  AZ/WA $500 baseline for unlisted states (the firm can override per
 *  state in Firm Policy). Static reader — works from anywhere. */
export function getFirmStandardHouseholdContribution(stateCode: string | null | undefined): number {
  const up = (stateCode ?? "").toUpperCase();
  if (up in _householdContributionByState) return _householdContributionByState[up];
  // No firm-set value for this state — return $500 baseline (matches the
  // AZ/WA defaults specified for the Part B feature).
  return 500;
}

/** Snapshot of the per-state contribution map — used by the Firm Policy
 *  editor to render the current state of every override. */
export function getFirmHouseholdContributionByState(): Readonly<Record<string, number>> {
  return _householdContributionByState;
}

export function setFirmStandardHouseholdContribution(stateCode: string, dollars: number): void {
  if (!stateCode || !Number.isFinite(dollars) || dollars < 0) return;
  _householdContributionByState = { ..._householdContributionByState, [stateCode.toUpperCase()]: dollars };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_HC_AMOUNT, JSON.stringify(_householdContributionByState));
    }
  } catch { /* ignore */ }
  _notify();
}

export function useFirmStandardHouseholdContribution(stateCode: string | null | undefined): number {
  const [v, setV] = useState<number>(getFirmStandardHouseholdContribution(stateCode));
  useEffect(() => {
    const sync = () => setV(getFirmStandardHouseholdContribution(stateCode));
    _subscribers.add(sync);
    return () => { _subscribers.delete(sync); };
  }, [stateCode]);
  return v;
}

// ─── Household-contribution treatment ───────────────────────────────────────

let _householdContributionTreatment: HouseholdContributionTreatment = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_HC_TREATMENT) : null;
    if (raw === "include_all_recurring" || raw === "include_recurring_non_ss" || raw === "attorney_per_case") return raw;
  } catch { /* ignore */ }
  return DEFAULT_HC_TREATMENT;
})();

export function getFirmHouseholdContributionTreatment(): HouseholdContributionTreatment {
  return _householdContributionTreatment;
}
export function getFirmHouseholdContributionTreatmentDefault(): HouseholdContributionTreatment {
  return DEFAULT_HC_TREATMENT;
}
export function setFirmHouseholdContributionTreatment(t: HouseholdContributionTreatment): void {
  _householdContributionTreatment = t;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_HC_TREATMENT, t);
    }
  } catch { /* ignore */ }
  _notify();
}
export function useFirmHouseholdContributionTreatment(): HouseholdContributionTreatment {
  const [v, setV] = useState<HouseholdContributionTreatment>(_householdContributionTreatment);
  useEffect(() => {
    const sync = () => setV(_householdContributionTreatment);
    _subscribers.add(sync);
    return () => { _subscribers.delete(sync); };
  }, []);
  return v;
}

// ─── Minimum debt threshold for case acceptance ─────────────────────────────

let _minimumDebtThresholdDollars: number = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_MIN_DEBT) : null;
    if (raw != null) {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_MIN_DEBT_THRESHOLD_DOLLARS;
})();

export function getFirmMinimumDebtThreshold(): number {
  return _minimumDebtThresholdDollars;
}
export function getFirmMinimumDebtThresholdDefault(): number {
  return DEFAULT_MIN_DEBT_THRESHOLD_DOLLARS;
}
export function setFirmMinimumDebtThreshold(dollars: number): void {
  if (!Number.isFinite(dollars) || dollars < 0) return;
  _minimumDebtThresholdDollars = dollars;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MIN_DEBT, String(dollars));
    }
  } catch { /* ignore */ }
  _notify();
}
export function useFirmMinimumDebtThreshold(): number {
  const [v, setV] = useState<number>(_minimumDebtThresholdDollars);
  useEffect(() => {
    const sync = () => setV(_minimumDebtThresholdDollars);
    _subscribers.add(sync);
    return () => { _subscribers.delete(sync); };
  }, []);
  return v;
}

// ─── Firm primary filing state ──────────────────────────────────────────────
//
// The state the firm primarily files in. Used by the Local Rules page to
// offer a "jump to my state" shortcut and by future surfaces that need to
// default to the firm's home jurisdiction. Stored as the full state NAME
// (e.g. "Arizona") to match COURTS_BY_STATE + LocalRulesPage keys.
// TODO Phase B — derive from firms.primary_state once the column is wired.
const STORAGE_KEY_FIRM_STATE = "firmPolicy.firmPrimaryState";
const DEFAULT_FIRM_PRIMARY_STATE = "Arizona";

let _firmPrimaryState: string = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_FIRM_STATE) : null;
    if (raw && raw.trim()) return raw;
  } catch { /* ignore */ }
  return DEFAULT_FIRM_PRIMARY_STATE;
})();

export function getFirmPrimaryState(): string { return _firmPrimaryState; }
export function getFirmPrimaryStateDefault(): string { return DEFAULT_FIRM_PRIMARY_STATE; }
export function setFirmPrimaryState(state: string): void {
  if (!state || !state.trim()) return;
  _firmPrimaryState = state;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_FIRM_STATE, state);
    }
  } catch { /* ignore */ }
  _notify();
}
export function useFirmPrimaryState(): string {
  const [v, setV] = useState<string>(_firmPrimaryState);
  useEffect(() => {
    const sync = () => setV(_firmPrimaryState);
    _subscribers.add(sync);
    return () => { _subscribers.delete(sync); };
  }, []);
  return v;
}

// ─── Firm admitted practice jurisdictions ───────────────────────────────────
//
// The states this firm is admitted to practice in. Drives the Local Rules
// state list — only admitted states appear; everything else is hidden.
// Stored as full state NAMES (e.g. "Arizona") to match COURTS_BY_STATE +
// LocalRulesPage's `ALL_STATES` list.
//
// Default: the firm's primary state. Firm Policy carries the editor that
// adds / removes states from the set.
//
// TODO Phase B — derive from a `firms.admitted_states` jsonb column once
// the firm profile schema lands. For now, this is a firm-policy knob with
// per-tab localStorage mirror, same pattern as the other firm-policy
// settings in this file.
const STORAGE_KEY_FIRM_ADMITTED = "firmPolicy.firmAdmittedStates";

let _firmAdmittedStates: ReadonlyArray<string> = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_FIRM_ADMITTED) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch { /* ignore */ }
  // Default — just the firm's primary state. The firm expands this in
  // Firm Policy when they're admitted in additional jurisdictions.
  return [_firmPrimaryState];
})();

export function getFirmAdmittedStates(): ReadonlyArray<string> {
  return _firmAdmittedStates;
}

/** Replace the admitted-states list wholesale. The editor on Firm Policy
 *  uses this. Empty arrays are allowed — Local Rules renders an empty
 *  state telling the firm to configure their admitted jurisdictions. */
export function setFirmAdmittedStates(states: ReadonlyArray<string>): void {
  const cleaned = Array.from(new Set(states.filter(s => typeof s === "string" && s.trim().length > 0)));
  _firmAdmittedStates = cleaned;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_FIRM_ADMITTED, JSON.stringify(cleaned));
    }
  } catch { /* ignore */ }
  _notify();
}

/** Toggle a single state in / out of the admitted set. */
export function toggleFirmAdmittedState(state: string, admitted: boolean): void {
  if (!state || !state.trim()) return;
  const current = new Set(_firmAdmittedStates);
  if (admitted) current.add(state); else current.delete(state);
  setFirmAdmittedStates(Array.from(current));
}

export function useFirmAdmittedStates(): ReadonlyArray<string> {
  const [v, setV] = useState<ReadonlyArray<string>>(_firmAdmittedStates);
  useEffect(() => {
    const sync = () => setV(_firmAdmittedStates);
    _subscribers.add(sync);
    return () => { _subscribers.delete(sync); };
  }, []);
  return v;
}

// Full state name → 2-letter code. Mirror of the lookup in
// src/components/admin/exemptions.ts (kept inline to avoid importing from
// the components tree into the lib layer). Used to translate the
// full-name admitted-states list into the 2-letter keys that
// IRS_HOUSING_UTILITIES_2025 + EXEMPTIONS_BY_JURISDICTION use.
const STATE_NAME_TO_CODE_INTERNAL: Readonly<Record<string, string>> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI",
  Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
  Guam: "GU", "Northern Mariana Islands": "MP", "Puerto Rico": "PR",
  "Virgin Islands": "VI", "U.S. Virgin Islands": "VI", "American Samoa": "AS",
};

export function getFirmAdmittedStateCodes(): ReadonlyArray<string> {
  return _firmAdmittedStates.map(n => STATE_NAME_TO_CODE_INTERNAL[n] ?? n);
}

export function useFirmAdmittedStateCodes(): ReadonlyArray<string> {
  const names = useFirmAdmittedStates();
  return names.map(n => STATE_NAME_TO_CODE_INTERNAL[n] ?? n);
}

// ─── Firm Calendar Configuration ───────────────────────────────────────────
//
// The firm decides which department calendars exist and which appointment
// types each calendar offers. Court Calendar is special — its appointment
// types apply uniformly across every admitted state (the per-state split
// is rendered at the calendar UI layer, reading useFirmAdmittedStates()).
//
// Drives:
//   - Law Firm Settings → Calendar Configuration editor
//   - FirmCalendar department filter strip + appointment-type dropdown in
//     the New Event modal
//
// Storage: in-memory + per-tab localStorage. TODO Phase B —
// firm_calendar_config(firm_id, departments_jsonb, court_state_types_jsonb,
// set_by_user_id, set_at).

/** Department identifier — short stable string keyed by the calendar UI. */
export type CalendarDepartmentId = "intake" | "accounting" | "client_relations" | "court" | "legal";

/** A single appointment type within a department. The color drives the
 *  event-pill background on the calendar grid and the swatch on the
 *  configuration editor. */
export interface CalendarAppointmentType {
  /** Stable slug — keys events to this type so renames don't orphan
   *  existing events. Auto-derived from label on create. */
  id: string;
  /** Human-readable label rendered in the dropdown + event pill. */
  label: string;
  /** Hex color (e.g. "#3b82f6"). */
  color: string;
}

export interface CalendarDepartmentConfig {
  /** Stable id — used as the foreign key for events. */
  id: CalendarDepartmentId;
  /** Human-readable label rendered on the filter chip + section header. */
  label: string;
  /** Appointment types this department offers. The New Event modal reads
   *  this list for its appointment-type dropdown. Free-form, firm-
   *  edited in Calendar Configuration. */
  appointmentTypes: CalendarAppointmentType[];
  /** When true, the calendar UI splits this calendar by admitted state
   *  (reads from useFirmAdmittedStates) rather than rendering one
   *  combined list. Today only "court" sets this true. */
  splitByAdmittedState?: boolean;
  /** Per Dom's spec — these flags decorate the department; the actual
   *  mechanics are scaffold-only and flagged for follow-up wiring.
   *    - allowAdditionalTypes: users in the department can add appointment
   *      types beyond this list (default true).
   *    - supervisorReassignEnabled: department supervisors / super-admins
   *      may reassign appointments on demand.
   *    - sickAutoRescheduleEnabled: when a staff member calls out sick,
   *      their appointments auto-reschedule via the department's rules.
   *    - taskListFeedEnabled: appointments in this department auto-
   *      generate "upcoming" rows on the assigned staff member's task
   *      list. */
  allowAdditionalTypes?: boolean;
  supervisorReassignEnabled?: boolean;
  sickAutoRescheduleEnabled?: boolean;
  taskListFeedEnabled?: boolean;
}

export interface FirmCalendarConfig {
  departments: CalendarDepartmentConfig[];
}

const STORAGE_KEY_CAL_CFG = "firmPolicy.firmCalendarConfig";

/** Helper — derives a stable slug from a label so appointment-type ids
 *  stay readable + URL-safe. */
function slugifyAppointmentType(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function appt(label: string, color: string): CalendarAppointmentType {
  return { id: slugifyAppointmentType(label), label, color };
}

// Defaults reflect Dom's spec verbatim:
//   - Intake: new consult, follow up, out of office per employee
//   - Accounting: open list (firm customizes — empty default)
//   - Client Relations: general questions (non-legal)
//   - Court Calendar: ECF notices, hearings, Ch.13 deadlines, others
//   - Legal: signing review (paralegal), signing appointment with client,
//     existing client call, out of office
const DEFAULT_FIRM_CALENDAR_CONFIG: FirmCalendarConfig = {
  departments: [
    {
      id: "intake",
      label: "Intake",
      allowAdditionalTypes: true,
      supervisorReassignEnabled: true,
      sickAutoRescheduleEnabled: true,
      taskListFeedEnabled: true,
      appointmentTypes: [
        appt("New consult",                "#3b82f6"), // blue
        appt("Follow-up",                  "#06b6d4"), // cyan
        appt("Out of office",              "#94a3b8"), // slate
      ],
    },
    {
      id: "accounting",
      label: "Accounting",
      allowAdditionalTypes: true,
      supervisorReassignEnabled: true,
      sickAutoRescheduleEnabled: false,
      taskListFeedEnabled: true,
      // Open for firm customization — Dom: "just leave open for customization"
      appointmentTypes: [],
    },
    {
      id: "client_relations",
      label: "Client Relations",
      allowAdditionalTypes: true,
      supervisorReassignEnabled: true,
      sickAutoRescheduleEnabled: true,
      taskListFeedEnabled: true,
      appointmentTypes: [
        appt("General question (non-legal)", "#a855f7"), // purple
      ],
    },
    {
      id: "court",
      label: "Court Calendar",
      splitByAdmittedState: true,
      allowAdditionalTypes: true,
      supervisorReassignEnabled: false, // court appointments aren't reassignable by firm supervisors
      sickAutoRescheduleEnabled: false, // sick days don't reschedule court dates
      taskListFeedEnabled: true,
      appointmentTypes: [
        appt("ECF notice",                  "#ef4444"), // red
        appt("Scheduled hearing",           "#dc2626"), // red-600
        appt("Ch.13 deadline",              "#f97316"), // orange
        appt("Other deadline",              "#f59e0b"), // amber
      ],
    },
    {
      id: "legal",
      label: "Legal",
      allowAdditionalTypes: true,
      supervisorReassignEnabled: true,
      sickAutoRescheduleEnabled: true,
      taskListFeedEnabled: true,
      appointmentTypes: [
        appt("Signing review (paralegal)",  "#10b981"), // emerald
        appt("Signing appointment (client)", "#059669"), // emerald-600
        appt("Existing-client call",        "#0ea5e9"), // sky
        appt("Out of office",               "#94a3b8"), // slate
      ],
    },
  ],
};

/** Default color used to backfill appointment types that come back as
 *  plain strings from older localStorage payloads (pre-schema-upgrade). */
const APPT_TYPE_FALLBACK_COLOR = "#64748b"; // slate-500

let _firmCalendarConfig: FirmCalendarConfig = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_CAL_CFG) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { departments?: unknown };
      if (parsed && Array.isArray(parsed.departments)) {
        // Tolerant parse — accept either the new {id,label,color} shape OR
        // the legacy string[] shape (migrated in-place at first read).
        const cleaned = parsed.departments
          .map((rawDept): CalendarDepartmentConfig | null => {
            const d = rawDept as Partial<CalendarDepartmentConfig> & { appointmentTypes?: unknown };
            if (!d || typeof d.id !== "string" || typeof d.label !== "string") return null;
            const apptsRaw = Array.isArray(d.appointmentTypes) ? d.appointmentTypes : [];
            const appointmentTypes: CalendarAppointmentType[] = apptsRaw
              .map((t): CalendarAppointmentType | null => {
                if (typeof t === "string") {
                  return { id: slugifyAppointmentType(t), label: t, color: APPT_TYPE_FALLBACK_COLOR };
                }
                if (t && typeof t === "object") {
                  const obj = t as Partial<CalendarAppointmentType>;
                  if (typeof obj.label !== "string") return null;
                  return {
                    id: typeof obj.id === "string" && obj.id ? obj.id : slugifyAppointmentType(obj.label),
                    label: obj.label,
                    color: typeof obj.color === "string" && obj.color ? obj.color : APPT_TYPE_FALLBACK_COLOR,
                  };
                }
                return null;
              })
              .filter((x): x is CalendarAppointmentType => x !== null);
            return {
              id: d.id as CalendarDepartmentId,
              label: d.label,
              appointmentTypes,
              splitByAdmittedState: d.splitByAdmittedState === true,
              allowAdditionalTypes:        d.allowAdditionalTypes        !== false, // default true
              supervisorReassignEnabled:   d.supervisorReassignEnabled   === true,
              sickAutoRescheduleEnabled:   d.sickAutoRescheduleEnabled   === true,
              taskListFeedEnabled:         d.taskListFeedEnabled         !== false, // default true
            };
          })
          .filter((x): x is CalendarDepartmentConfig => x !== null);
        if (cleaned.length > 0) return { departments: cleaned };
      }
    }
  } catch { /* ignore */ }
  // Deep clone so callers can't mutate the default tree.
  return JSON.parse(JSON.stringify(DEFAULT_FIRM_CALENDAR_CONFIG)) as FirmCalendarConfig;
})();

export function getFirmCalendarConfig(): FirmCalendarConfig { return _firmCalendarConfig; }
export function getFirmCalendarConfigDefault(): FirmCalendarConfig {
  return JSON.parse(JSON.stringify(DEFAULT_FIRM_CALENDAR_CONFIG)) as FirmCalendarConfig;
}

/** Replace the whole config (editor save). */
export function setFirmCalendarConfig(next: FirmCalendarConfig): void {
  _firmCalendarConfig = next;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CAL_CFG, JSON.stringify(next));
    }
  } catch { /* ignore */ }
  _notify();
}

/** Convenience — update one department's appointment-type list. */
export function setDepartmentAppointmentTypes(
  departmentId: CalendarDepartmentId,
  appointmentTypes: ReadonlyArray<CalendarAppointmentType>,
): void {
  const next: FirmCalendarConfig = {
    departments: _firmCalendarConfig.departments.map(d =>
      d.id === departmentId
        ? { ...d, appointmentTypes: appointmentTypes.slice() }
        : d,
    ),
  };
  setFirmCalendarConfig(next);
}

/** Patch one department's flag fields (supervisor / sick / task-feed / allow-additional). */
export function setDepartmentFlags(
  departmentId: CalendarDepartmentId,
  flags: Partial<Pick<
    CalendarDepartmentConfig,
    "supervisorReassignEnabled" | "sickAutoRescheduleEnabled" | "taskListFeedEnabled" | "allowAdditionalTypes"
  >>,
): void {
  const next: FirmCalendarConfig = {
    departments: _firmCalendarConfig.departments.map(d =>
      d.id === departmentId ? { ...d, ...flags } : d,
    ),
  };
  setFirmCalendarConfig(next);
}

/** Add a single appointment type to a department. No-ops on duplicate id. */
export function addDepartmentAppointmentType(
  departmentId: CalendarDepartmentId,
  type: CalendarAppointmentType,
): void {
  const dept = _firmCalendarConfig.departments.find(d => d.id === departmentId);
  if (!dept) return;
  if (dept.appointmentTypes.some(t => t.id === type.id)) return;
  setDepartmentAppointmentTypes(departmentId, [...dept.appointmentTypes, type]);
}

/** Helper exposed so the editor can derive a stable id from a fresh label. */
export const buildAppointmentTypeFromLabel = (
  label: string,
  color: string,
): CalendarAppointmentType => appt(label, color);

export function useFirmCalendarConfig(): FirmCalendarConfig {
  const [v, setV] = useState<FirmCalendarConfig>(_firmCalendarConfig);
  useEffect(() => {
    const sync = () => setV(_firmCalendarConfig);
    _subscribers.add(sync);
    return () => { _subscribers.delete(sync); };
  }, []);
  return v;
}
