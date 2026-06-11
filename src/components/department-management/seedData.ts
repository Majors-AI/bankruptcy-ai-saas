// Seed data for the Department Management surface.
//
// REAL DATA, NOT FABRICATED USER DATA — these are the firm-template seeds
// that ship out of the box. The user (Dom + firm admins) edits these in
// place; persistence is TODO so the seed survives the page load and any
// new edits live in memory until the Supabase tables land.
//
// Accounting task seeds spelled per the spec:
//   - Saving clients from cancelling (High)
//   - Adjusting payments (Medium, SEPARATE task)
//   - Confirming new-client setup (Medium)
//   - Manual setup / porting from another system (Medium, as-needed)
//   - Collections (Low)
//
// Intake and Legal start with one placeholder task each; firms add more from
// the Tasks tab. No defaulted strength scores — values stay blank until a
// supervisor records one (matches the existing scaffold contract).

import type {
  Department,
  DeptTask,
  HoursOfOperation,
  ResponseTemplate,
  StaffMember,
  KBDoc,
  CollectionsAccount,
  Priority,
} from "./types";

// ─── Hours of operation default ────────────────────────────────────────────
//
// Mon-Fri 8a–5p, weekend closed. Matches the typical firm baseline; super
// admin / supervisor edits per-day.
const DEFAULT_HOURS: HoursOfOperation = {
  mon: { closed: false, open: "08:00", close: "17:00" },
  tue: { closed: false, open: "08:00", close: "17:00" },
  wed: { closed: false, open: "08:00", close: "17:00" },
  thu: { closed: false, open: "08:00", close: "17:00" },
  fri: { closed: false, open: "08:00", close: "17:00" },
  sat: { closed: true,  open: "09:00", close: "13:00" },
  sun: { closed: true,  open: "09:00", close: "13:00" },
};

export const SEED_DEPARTMENTS: Department[] = [
  { id: "intake",     label: "Intake",                   supervisorId: null, hours: { ...DEFAULT_HOURS } },
  { id: "accounting", label: "Accounting",               supervisorId: null, hours: { ...DEFAULT_HOURS } },
  // Mass mail-merge hub — scaffold only. The page surfaces a "To be built"
  // notice; the standard department structure (team-by-title, tasks,
  // strength scores, supervisor, settings, per-employee reporting) lands
  // when the feature is built out.
  { id: "client_pr",  label: "Client Public Relations",  supervisorId: null, hours: { ...DEFAULT_HOURS } },
  { id: "legal",      label: "Legal",                    supervisorId: null, hours: { ...DEFAULT_HOURS } },
];

export const SEED_TASKS: DeptTask[] = [
  // Accounting (spec-driven)
  { id: "acct-saving",      departmentId: "accounting", label: "Saving clients from cancelling",        priority: "high",   lawyerOnly: false },
  { id: "acct-adjustments", departmentId: "accounting", label: "Adjusting payments",                    priority: "medium", lawyerOnly: false, note: "Separate task from saving-from-cancelling." },
  { id: "acct-newclient",   departmentId: "accounting", label: "Confirming new-client setup",           priority: "medium", lawyerOnly: false },
  { id: "acct-manualsetup", departmentId: "accounting", label: "Manual setup / porting from another system", priority: "medium", lawyerOnly: false, note: "As-needed." },
  { id: "acct-collections", departmentId: "accounting", label: "Collections",                           priority: "low",    lawyerOnly: false },

  // Intake (placeholder — uses existing color/priority rules)
  { id: "intake-newlead",   departmentId: "intake",     label: "New-lead intake call",                  priority: "high",   lawyerOnly: false },
  { id: "intake-followup",  departmentId: "intake",     label: "Follow-up on stale leads",              priority: "medium", lawyerOnly: false },

  // Legal (placeholders — case review + welcome calls)
  { id: "legal-casereview", departmentId: "legal",      label: "Case review",                           priority: "high",   lawyerOnly: true },
  { id: "legal-welcome",    departmentId: "legal",      label: "Welcome calls (post-retainer)",         priority: "medium", lawyerOnly: false },
];

// Seed staff is intentionally empty — the firm adds team members manually.
// Show the roster columns even when empty so the layout is visible.
export const SEED_STAFF: StaffMember[] = [];

// Seed templates — three per department, spec-aligned for response-template
// types. Firms add their own custom templates.
export const SEED_TEMPLATES: ResponseTemplate[] = [
  // Intake
  { id: "tmpl-int-caseupd",   departmentId: "intake",     label: "Case Update",              body: "Hi {first_name} — quick update on where things stand with your matter…", channels: ["sms", "email"] },
  { id: "tmpl-int-rfi",       departmentId: "intake",     label: "Request for Information",  body: "Hi {first_name} — to keep things moving we need…",                       channels: ["sms", "email"] },
  { id: "tmpl-int-missed",    departmentId: "intake",     label: "Missed Appointment",       body: "Hi {first_name} — we missed you today. Let us know the best time to reschedule.", channels: ["sms", "email"] },
  // Accounting
  { id: "tmpl-acct-caseupd",  departmentId: "accounting", label: "Case Update",              body: "Hi {first_name} — your account is current through {through_date}…",     channels: ["email"] },
  { id: "tmpl-acct-rfi",      departmentId: "accounting", label: "Request for Information",  body: "Hi {first_name} — we need an updated payment method to keep your plan on track.", channels: ["sms", "email"] },
  { id: "tmpl-acct-missed",   departmentId: "accounting", label: "Missed Appointment",       body: "Hi {first_name} — sorry we missed our call about your account today.",     channels: ["sms"] },
  // Legal
  { id: "tmpl-leg-caseupd",   departmentId: "legal",      label: "Case Update",              body: "Hi {first_name} — your case status: {status}.",                          channels: ["email"] },
  { id: "tmpl-leg-rfi",       departmentId: "legal",      label: "Request for Information",  body: "Hi {first_name} — your attorney needs the following documents…",        channels: ["email"] },
  { id: "tmpl-leg-missed",    departmentId: "legal",      label: "Missed Appointment",       body: "Hi {first_name} — we missed you at the signing appointment.",             channels: ["sms", "email"] },
];

export const SEED_KB_DOCS: KBDoc[] = [];

// Collections seed queue — illustrative, NOT real client data. Three
// representative accounts so the queue layout is visible without inventing
// names that look like a roster. Replace with the firm's real accounts when
// the accounting tables wire up.
export const SEED_COLLECTIONS_QUEUE: CollectionsAccount[] = [
  { id: "coll-1", clientName: "[Demo] Client A", ageDays: 45, amountOwed: 850,  priority: "high",   status: "queued" },
  { id: "coll-2", clientName: "[Demo] Client B", ageDays: 22, amountOwed: 425,  priority: "medium", status: "queued" },
  { id: "coll-3", clientName: "[Demo] Client C", ageDays: 8,  amountOwed: 200,  priority: "low",    status: "queued" },
];

// ─── Title catalog (for staff roster columns) ──────────────────────────────

export interface TitleDef {
  key: string;
  label: string;
  /** True for attorney + attorney_supervisor + of_counsel — drives the
   *  non-lawyer edit lockout. */
  isLawyer: boolean;
}

export const TITLE_CATALOG: TitleDef[] = [
  { key: "attorney",             label: "Attorney",            isLawyer: true  },
  { key: "attorney_supervisor",  label: "Attorney Supervisor", isLawyer: true  },
  { key: "of_counsel",           label: "Of-Counsel",          isLawyer: true  },
  { key: "paralegal",            label: "Paralegal",           isLawyer: false },
  { key: "legal_administrator",  label: "Legal Administrator", isLawyer: false },
  { key: "intake_specialist",    label: "Intake Specialist",   isLawyer: false },
  { key: "accounting",           label: "Accounting",          isLawyer: false },
  { key: "receptionist",         label: "Receptionist",        isLawyer: false },
];

export const PRIORITY_TONE: Record<Priority, string> = {
  high:   "bg-red-900/40 text-red-200 border-red-700/40",
  medium: "bg-amber-900/40 text-amber-200 border-amber-700/40",
  low:    "bg-slate-800 text-slate-300 border-slate-700",
};

export function titleLabel(key: string): string {
  return TITLE_CATALOG.find(t => t.key === key)?.label
    ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function isLawyerTitle(key: string): boolean {
  return TITLE_CATALOG.find(t => t.key === key)?.isLawyer ?? false;
}
