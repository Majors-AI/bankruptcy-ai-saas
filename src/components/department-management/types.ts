// Shared types for the Super Admin Setting Portal's Department Management
// surface. Scaffold-with-real-UI: state is held in a React context (see
// store.tsx) so writes mirror across every consumer in one source of truth.
// Persistence (Supabase tables, RLS, server-side audit) is TODO — wiring
// notes live next to each store action.

export type Priority = "high" | "medium" | "low";

// Built-in department IDs. Custom departments (future) are also strings.
export type DepartmentId = "intake" | "accounting" | "legal" | string;

// Built-in titles. The roster column layout uses these; custom roles slot
// into an "Other" column.
export type Title =
  | "attorney"
  | "attorney_supervisor"
  | "paralegal"
  | "legal_administrator"
  | "intake_specialist"
  | "accounting"
  | "receptionist"
  | "of_counsel"
  | string;

// Role surface for the panel. Drives every gate inside the module so the
// caller only has to pass one viewerRole through.
export type ViewerRole =
  | "law_firm_owner"
  | "super_admin"
  | "department_supervisor"
  | "attorney"
  | "non_lawyer_staff";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  title: Title;
  /** Staff can be in more than one department. */
  departmentIds: DepartmentId[];
  supervisorId: string | null;
}

export interface Department {
  id: DepartmentId;
  label: string;
  /** Department supervisor — non-super-admin viewer is scoped here. */
  supervisorId: string | null;
  hours: HoursOfOperation;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface HoursOfOperation {
  mon: DayHours;
  tue: DayHours;
  wed: DayHours;
  thu: DayHours;
  fri: DayHours;
  sat: DayHours;
  sun: DayHours;
}

export interface DayHours {
  closed: boolean;
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
}

export interface DeptTask {
  id: string;
  departmentId: DepartmentId;
  label: string;
  priority: Priority;
  /** Lawyer/attorney-only tasks — non-lawyers can't edit them or their rules. */
  lawyerOnly: boolean;
  /** e.g. "as needed", "separate from saving-from-cancelling". */
  note?: string;
}

/** Strength scores are SCOPED PER DEPARTMENT — values do not carry between
 *  departments even for the same staff/task pair. */
export interface StrengthScore {
  staffId: string;
  departmentId: DepartmentId;
  taskId: string;
  /** 0..100 slider. 0 = no strength; 100 = top of bench. */
  value: number;
}

export type TemplateChannel = "sms" | "email";

export interface ResponseTemplate {
  id: string;
  departmentId: DepartmentId;
  label: string;
  body: string;
  channels: TemplateChannel[];
}

export interface KBDoc {
  id: string;
  departmentId: DepartmentId;
  title: string;
  body?: string;
  authorizedForAi: boolean;
  uploadedAt: string;
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  /** Stable key used by approval gates to identify the function. */
  function_key: string;
  description: string;
  /** Optional payload — kept structured so the log view can render context. */
  meta?: Record<string, unknown>;
}

// ─── Approval gates ─────────────────────────────────────────────────────────
//
// The Law Firm Owner can flag specific function_keys as requiring approval
// before taking effect. A pending change is held in queue; an approver
// (supervising attorney OR a specifically-named approver) acts on it.

export interface ApprovalGate {
  id: string;
  function_key: string;
  /** Scope: null = firm-wide; otherwise restricts to a single department. */
  departmentId: DepartmentId | null;
  /** Resolved approver. null = default (department supervisor → owner). */
  approverStaffId: string | null;
  enabled: boolean;
}

export interface PendingChange {
  id: string;
  function_key: string;
  description: string;
  payload: unknown;
  requestedBy: string;
  requestedAt: string;
  /** Suggested approver at queue time — may be re-resolved on approval. */
  approverStaffId: string | null;
  status: "pending" | "approved" | "rejected";
  resolvedBy?: string;
  resolvedAt?: string;
  rejectReason?: string;
}

// ─── Reporting ──────────────────────────────────────────────────────────────

export type GoalQuarter = "Q1" | "Q2" | "Q3" | "Q4";

export interface Goal {
  id: string;
  staffId: string;
  departmentId: DepartmentId;
  metric: string;
  quarter: GoalQuarter;
  year: number;
  value: number;
}

// Tasks-handled counts + goals/results for one staff member in one department.
// Per-employee reporting renders one column per department for staff in >1.
export interface ReportingRow {
  staffId: string;
  departmentId: DepartmentId;
  tasksHandled: Record<string /* taskId */, number>;
  /** Goal value vs. actual, keyed by metric+quarter+year. */
  goalResults: Array<{
    metric: string;
    quarter: GoalQuarter;
    year: number;
    goal: number;
    actual: number;
  }>;
}

// ─── Collections ────────────────────────────────────────────────────────────

export type CollectionsDisposition =
  | "paid"
  | "promise_to_pay"
  | "no_answer"
  | "adjust_payment"
  | "saved_from_cancel";

export interface CollectionsAccount {
  id: string;
  clientName: string;
  /** Days past due. */
  ageDays: number;
  amountOwed: number;
  priority: Priority;
  lastContact?: string;
  status: "queued" | "in_progress" | "resolved";
}
