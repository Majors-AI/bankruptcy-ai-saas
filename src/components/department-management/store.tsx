// Department Management store — single source of truth shared by every
// surface inside the module so changes mirror system-wide.
//
// SCAFFOLD persistence: the state lives in memory only. Every mutator is
// wrapped to append an audit entry and (where the function_key is
// approval-gated) defer the write to a pending-approval queue.
//
// TODO Phase B — Supabase persistence wiring:
//   - departments / staff_members / dept_tasks / staff_strength_scores /
//     response_templates / firm_kb_documents / approval_gates /
//     pending_changes / audit_log tables
//   - per-firm tenancy + RLS on every read/write
//   - server-side replay of approval-gate enforcement so the rule survives a
//     tampered client (the client gate here is defense-in-depth only)
//   - mirror invalidation: a change in this store should bust caches on
//     consumer screens that read the same data (StaffSettingsPanel,
//     DepartmentSettingsPanel, IntakeDashboard task routing, etc.)

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from "react";
import type {
  Department, StaffMember, DeptTask, StrengthScore, ResponseTemplate, KBDoc,
  ApprovalGate, PendingChange, AuditEntry, Priority, DepartmentId,
  Goal, ReportingRow, GoalQuarter, CollectionsAccount, CollectionsDisposition,
  ViewerRole,
} from "./types";
import {
  SEED_DEPARTMENTS, SEED_TASKS, SEED_STAFF, SEED_TEMPLATES, SEED_KB_DOCS,
  SEED_COLLECTIONS_QUEUE,
} from "./seedData";

// ─── Function keys — stable identifiers for approval gates + audit ──────────
//
// Every mutator threads a function_key through. Approval gates match on
// this key (with optional departmentId scope); audit entries record it so
// the log filter can pivot on it.

export const FN = {
  // Departments
  DEPT_UPDATE_SUPERVISOR: "dept.update_supervisor",
  DEPT_UPDATE_HOURS: "dept.update_hours",
  // Staff
  STAFF_ADD: "staff.add",
  STAFF_REMOVE: "staff.remove",
  STAFF_UPDATE: "staff.update",
  STAFF_ASSIGN_DEPT: "staff.assign_dept",
  // Tasks
  TASK_ADD: "task.add",
  TASK_REMOVE: "task.remove",
  TASK_UPDATE: "task.update",
  TASK_UPDATE_PRIORITY: "task.update_priority",
  // Strength scores
  SCORE_SET: "score.set",
  // Templates
  TEMPLATE_ADD: "template.add",
  TEMPLATE_UPDATE: "template.update",
  TEMPLATE_REMOVE: "template.remove",
  // Knowledge base
  KB_ADD: "kb.add",
  KB_TOGGLE_AUTHORIZED: "kb.toggle_authorized",
  KB_REMOVE: "kb.remove",
  // Goals
  GOAL_SET: "goal.set",
  // Approval gates / pending
  GATE_CONFIGURE: "gate.configure",
  PENDING_APPROVE: "pending.approve",
  PENDING_REJECT: "pending.reject",
} as const;

export type FunctionKey = typeof FN[keyof typeof FN];

// ─── Store shape ────────────────────────────────────────────────────────────

interface Actor {
  id: string;
  name: string;
  role: ViewerRole;
}

interface StoreState {
  // Caller identity — derived from props on the host; the store uses it for
  // permission + audit/actor stamping. Defaults to a "super_admin" stub so
  // the UI mounts standalone during development.
  actor: Actor;

  departments: Department[];
  staff: StaffMember[];
  tasks: DeptTask[];
  scores: StrengthScore[];
  templates: ResponseTemplate[];
  kbDocs: KBDoc[];
  goals: Goal[];
  reporting: ReportingRow[]; // populated as work happens; today seeded empty
  approvalGates: ApprovalGate[];
  pending: PendingChange[];
  auditLog: AuditEntry[];

  // Collections workspace
  collectionsQueue: CollectionsAccount[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Resolve whether a function_key is gated for the given department. */
function findGate(
  gates: ApprovalGate[], function_key: string, deptId: DepartmentId | null,
): ApprovalGate | null {
  return gates.find(g =>
    g.enabled
    && g.function_key === function_key
    && (g.departmentId === null || g.departmentId === deptId)
  ) ?? null;
}

// ─── Context ────────────────────────────────────────────────────────────────

interface StoreApi extends StoreState {
  // Direct mutators (the actor must be permitted; otherwise the store
  // routes through the pending-approval queue).
  addStaff(input: Omit<StaffMember, "id">): void;
  removeStaff(id: string): void;
  updateStaff(id: string, patch: Partial<StaffMember>): void;

  addTask(input: Omit<DeptTask, "id">): void;
  removeTask(id: string): void;
  updateTask(id: string, patch: Partial<DeptTask>): void;
  setTaskPriority(id: string, priority: Priority): void;

  setStrengthScore(staffId: string, departmentId: DepartmentId, taskId: string, value: number): void;

  setDepartmentSupervisor(deptId: DepartmentId, supervisorId: string | null): void;
  setDepartmentHours(deptId: DepartmentId, hours: Department["hours"]): void;

  addTemplate(input: Omit<ResponseTemplate, "id">): void;
  updateTemplate(id: string, patch: Partial<ResponseTemplate>): void;
  removeTemplate(id: string): void;

  addKbDoc(input: Omit<KBDoc, "id" | "uploadedAt">): void;
  toggleKbAuthorized(id: string): void;
  removeKbDoc(id: string): void;

  setGoal(input: Omit<Goal, "id"> & { id?: string }): void;

  // Approval gates
  upsertGate(gate: Omit<ApprovalGate, "id"> & { id?: string }): void;
  approvePending(pendingId: string): void;
  rejectPending(pendingId: string, reason?: string): void;

  // Collections
  pickNextCollectionsAccount(): CollectionsAccount | null;
  disposeCollections(accountId: string, disposition: CollectionsDisposition, note?: string): void;

  // For external surfaces that need to log a manual entry.
  appendAudit(entry: Omit<AuditEntry, "id" | "ts" | "actor">): void;
}

const Ctx = createContext<StoreApi | null>(null);

// Default actor stub. The host passes a real actor via props on the
// provider; this default keeps the surface mountable in isolation.
const DEFAULT_ACTOR: Actor = { id: "actor-stub", name: "Super Admin", role: "super_admin" };

export function DepartmentManagementProvider({
  children, actor,
}: {
  children: ReactNode;
  actor?: Actor;
}) {
  const [state, setState] = useState<StoreState>(() => ({
    actor: actor ?? DEFAULT_ACTOR,
    departments: SEED_DEPARTMENTS.map(d => ({ ...d })),
    staff: SEED_STAFF.map(s => ({ ...s })),
    tasks: SEED_TASKS.map(t => ({ ...t })),
    scores: [],
    templates: SEED_TEMPLATES.map(t => ({ ...t })),
    kbDocs: SEED_KB_DOCS.map(k => ({ ...k })),
    goals: [],
    reporting: [],
    approvalGates: [],
    pending: [],
    auditLog: [],
    collectionsQueue: SEED_COLLECTIONS_QUEUE.map(c => ({ ...c })),
  }));

  // ─── Audit helper ─────────────────────────────────────────────────────────
  const appendAudit = useCallback((entry: Omit<AuditEntry, "id" | "ts" | "actor">) => {
    setState(prev => ({
      ...prev,
      auditLog: [
        {
          id: uid("aud"),
          ts: nowIso(),
          actor: prev.actor.name,
          ...entry,
        },
        ...prev.auditLog,
      ],
    }));
  }, []);

  // Internal: run mutation or queue it as pending depending on approval-gate
  // configuration. The mutator receives the current state and returns the
  // new state.
  const guardedWrite = useCallback(<P,>(opts: {
    function_key: FunctionKey;
    deptId: DepartmentId | null;
    description: string;
    payload: P;
    apply: (prev: StoreState, payload: P) => StoreState;
  }) => {
    setState(prev => {
      const gate = findGate(prev.approvalGates, opts.function_key, opts.deptId);
      // Owner & super_admin bypass approval gates (owner is the rule-setter;
      // super_admin executes on the owner's behalf). Supervisors of the
      // affected department also bypass when the gate's approver isn't set
      // to someone specifically OTHER than them.
      const isOwner = prev.actor.role === "law_firm_owner";
      const isSuper = prev.actor.role === "super_admin";
      const isSupervisorOfDept = prev.actor.role === "department_supervisor"
        && opts.deptId != null
        && prev.departments.find(d => d.id === opts.deptId)?.supervisorId === prev.actor.id;
      const bypass = isOwner || isSuper || isSupervisorOfDept;
      if (gate && !bypass) {
        const pending: PendingChange = {
          id: uid("pend"),
          function_key: opts.function_key,
          description: opts.description,
          payload: opts.payload,
          requestedBy: prev.actor.name,
          requestedAt: nowIso(),
          approverStaffId: gate.approverStaffId,
          status: "pending",
        };
        const audit: AuditEntry = {
          id: uid("aud"),
          ts: nowIso(),
          actor: prev.actor.name,
          function_key: opts.function_key,
          description: `Queued for approval: ${opts.description}`,
          meta: { gateId: gate.id, pendingId: pending.id, deptId: opts.deptId },
        };
        return { ...prev, pending: [pending, ...prev.pending], auditLog: [audit, ...prev.auditLog] };
      }

      // Bypass — apply immediately + audit.
      const next = opts.apply(prev, opts.payload);
      const audit: AuditEntry = {
        id: uid("aud"),
        ts: nowIso(),
        actor: prev.actor.name,
        function_key: opts.function_key,
        description: opts.description,
        meta: { deptId: opts.deptId },
      };
      return { ...next, auditLog: [audit, ...next.auditLog] };
    });
  }, []);

  // ─── Staff ────────────────────────────────────────────────────────────────

  const addStaff = useCallback((input: Omit<StaffMember, "id">) => {
    guardedWrite({
      function_key: FN.STAFF_ADD,
      deptId: input.departmentIds[0] ?? null,
      description: `Added staff: ${input.name}`,
      payload: input,
      apply: (prev, payload) => ({
        ...prev,
        staff: [...prev.staff, { id: uid("staff"), ...payload }],
      }),
    });
  }, [guardedWrite]);

  const removeStaff = useCallback((id: string) => {
    guardedWrite({
      function_key: FN.STAFF_REMOVE,
      deptId: null,
      description: `Removed staff: ${id}`,
      payload: { id },
      apply: (prev, p) => ({
        ...prev,
        staff: prev.staff.filter(s => s.id !== p.id),
        // Wipe their scores too — score scope is per department × task ×
        // staff; once the staffer is gone the rows are orphaned.
        scores: prev.scores.filter(s => s.staffId !== p.id),
      }),
    });
  }, [guardedWrite]);

  const updateStaff = useCallback((id: string, patch: Partial<StaffMember>) => {
    guardedWrite({
      function_key: FN.STAFF_UPDATE,
      deptId: null,
      description: `Updated staff: ${id}`,
      payload: { id, patch },
      apply: (prev, p) => ({
        ...prev,
        staff: prev.staff.map(s => s.id === p.id ? { ...s, ...p.patch } : s),
      }),
    });
  }, [guardedWrite]);

  // ─── Tasks ────────────────────────────────────────────────────────────────

  const addTask = useCallback((input: Omit<DeptTask, "id">) => {
    guardedWrite({
      function_key: FN.TASK_ADD,
      deptId: input.departmentId,
      description: `Added task: ${input.label} (${input.departmentId})`,
      payload: input,
      apply: (prev, payload) => ({
        ...prev,
        tasks: [...prev.tasks, { id: uid("tsk"), ...payload }],
      }),
    });
  }, [guardedWrite]);

  const removeTask = useCallback((id: string) => {
    const task = state.tasks.find(t => t.id === id);
    guardedWrite({
      function_key: FN.TASK_REMOVE,
      deptId: task?.departmentId ?? null,
      description: `Removed task: ${task?.label ?? id}`,
      payload: { id },
      apply: (prev, p) => ({
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== p.id),
        scores: prev.scores.filter(s => s.taskId !== p.id),
      }),
    });
  }, [guardedWrite, state.tasks]);

  const updateTask = useCallback((id: string, patch: Partial<DeptTask>) => {
    const task = state.tasks.find(t => t.id === id);
    guardedWrite({
      function_key: FN.TASK_UPDATE,
      deptId: task?.departmentId ?? null,
      description: `Updated task: ${task?.label ?? id}`,
      payload: { id, patch },
      apply: (prev, p) => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === p.id ? { ...t, ...p.patch } : t),
      }),
    });
  }, [guardedWrite, state.tasks]);

  const setTaskPriority = useCallback((id: string, priority: Priority) => {
    const task = state.tasks.find(t => t.id === id);
    guardedWrite({
      function_key: FN.TASK_UPDATE_PRIORITY,
      deptId: task?.departmentId ?? null,
      description: `Set task priority: ${task?.label ?? id} → ${priority}`,
      payload: { id, priority },
      apply: (prev, p) => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === p.id ? { ...t, priority: p.priority } : t),
      }),
    });
  }, [guardedWrite, state.tasks]);

  // ─── Strength scores ──────────────────────────────────────────────────────

  const setStrengthScore = useCallback(
    (staffId: string, departmentId: DepartmentId, taskId: string, value: number) => {
      guardedWrite({
        function_key: FN.SCORE_SET,
        deptId: departmentId,
        description: `Set strength score: ${staffId} / ${taskId} = ${value}`,
        payload: { staffId, departmentId, taskId, value },
        apply: (prev, p) => {
          const others = prev.scores.filter(s =>
            !(s.staffId === p.staffId && s.departmentId === p.departmentId && s.taskId === p.taskId)
          );
          return { ...prev, scores: [...others, p] };
        },
      });
    }, [guardedWrite]);

  // ─── Department supervisor + hours ────────────────────────────────────────

  const setDepartmentSupervisor = useCallback((deptId: DepartmentId, supervisorId: string | null) => {
    guardedWrite({
      function_key: FN.DEPT_UPDATE_SUPERVISOR,
      deptId,
      description: `Set supervisor for ${deptId}: ${supervisorId ?? "(none)"}`,
      payload: { deptId, supervisorId },
      apply: (prev, p) => ({
        ...prev,
        departments: prev.departments.map(d => d.id === p.deptId ? { ...d, supervisorId: p.supervisorId } : d),
      }),
    });
  }, [guardedWrite]);

  const setDepartmentHours = useCallback((deptId: DepartmentId, hours: Department["hours"]) => {
    guardedWrite({
      function_key: FN.DEPT_UPDATE_HOURS,
      deptId,
      description: `Updated hours for ${deptId}`,
      payload: { deptId, hours },
      apply: (prev, p) => ({
        ...prev,
        departments: prev.departments.map(d => d.id === p.deptId ? { ...d, hours: p.hours } : d),
      }),
    });
  }, [guardedWrite]);

  // ─── Response templates ──────────────────────────────────────────────────

  const addTemplate = useCallback((input: Omit<ResponseTemplate, "id">) => {
    guardedWrite({
      function_key: FN.TEMPLATE_ADD,
      deptId: input.departmentId,
      description: `Added template: ${input.label}`,
      payload: input,
      apply: (prev, payload) => ({
        ...prev,
        templates: [...prev.templates, { id: uid("tmpl"), ...payload }],
      }),
    });
  }, [guardedWrite]);

  const updateTemplate = useCallback((id: string, patch: Partial<ResponseTemplate>) => {
    const tmpl = state.templates.find(t => t.id === id);
    guardedWrite({
      function_key: FN.TEMPLATE_UPDATE,
      deptId: tmpl?.departmentId ?? null,
      description: `Updated template: ${tmpl?.label ?? id}`,
      payload: { id, patch },
      apply: (prev, p) => ({
        ...prev,
        templates: prev.templates.map(t => t.id === p.id ? { ...t, ...p.patch } : t),
      }),
    });
  }, [guardedWrite, state.templates]);

  const removeTemplate = useCallback((id: string) => {
    const tmpl = state.templates.find(t => t.id === id);
    guardedWrite({
      function_key: FN.TEMPLATE_REMOVE,
      deptId: tmpl?.departmentId ?? null,
      description: `Removed template: ${tmpl?.label ?? id}`,
      payload: { id },
      apply: (prev, p) => ({
        ...prev,
        templates: prev.templates.filter(t => t.id !== p.id),
      }),
    });
  }, [guardedWrite, state.templates]);

  // ─── KB docs ─────────────────────────────────────────────────────────────

  const addKbDoc = useCallback((input: Omit<KBDoc, "id" | "uploadedAt">) => {
    guardedWrite({
      function_key: FN.KB_ADD,
      deptId: input.departmentId,
      description: `Added KB doc: ${input.title}`,
      payload: input,
      apply: (prev, payload) => ({
        ...prev,
        kbDocs: [...prev.kbDocs, { id: uid("kb"), uploadedAt: nowIso(), ...payload }],
      }),
    });
  }, [guardedWrite]);

  const toggleKbAuthorized = useCallback((id: string) => {
    const doc = state.kbDocs.find(d => d.id === id);
    guardedWrite({
      function_key: FN.KB_TOGGLE_AUTHORIZED,
      deptId: doc?.departmentId ?? null,
      description: `Toggled KB authorization: ${doc?.title ?? id}`,
      payload: { id },
      apply: (prev, p) => ({
        ...prev,
        kbDocs: prev.kbDocs.map(d => d.id === p.id ? { ...d, authorizedForAi: !d.authorizedForAi } : d),
      }),
    });
  }, [guardedWrite, state.kbDocs]);

  const removeKbDoc = useCallback((id: string) => {
    const doc = state.kbDocs.find(d => d.id === id);
    guardedWrite({
      function_key: FN.KB_REMOVE,
      deptId: doc?.departmentId ?? null,
      description: `Removed KB doc: ${doc?.title ?? id}`,
      payload: { id },
      apply: (prev, p) => ({
        ...prev,
        kbDocs: prev.kbDocs.filter(d => d.id !== p.id),
      }),
    });
  }, [guardedWrite, state.kbDocs]);

  // ─── Goals ────────────────────────────────────────────────────────────────

  const setGoal = useCallback((input: Omit<Goal, "id"> & { id?: string }) => {
    guardedWrite({
      function_key: FN.GOAL_SET,
      deptId: input.departmentId,
      description: `Set goal: ${input.metric} ${input.quarter}/${input.year} = ${input.value}`,
      payload: input,
      apply: (prev, p) => {
        const existingIdx = prev.goals.findIndex(g =>
          g.staffId === p.staffId
          && g.departmentId === p.departmentId
          && g.metric === p.metric
          && g.quarter === p.quarter
          && g.year === p.year
        );
        const next: Goal = { id: p.id ?? uid("goal"), ...p } as Goal;
        const goals = existingIdx >= 0
          ? prev.goals.map((g, i) => i === existingIdx ? { ...g, value: p.value } : g)
          : [...prev.goals, next];
        return { ...prev, goals };
      },
    });
  }, [guardedWrite]);

  // ─── Approval gates ──────────────────────────────────────────────────────

  const upsertGate = useCallback((gate: Omit<ApprovalGate, "id"> & { id?: string }) => {
    setState(prev => {
      // Owner-only; non-owner attempts are ignored (no harm — the UI gates
      // the button itself). Audited regardless.
      const isOwner = prev.actor.role === "law_firm_owner";
      if (!isOwner) {
        return {
          ...prev,
          auditLog: [{
            id: uid("aud"),
            ts: nowIso(),
            actor: prev.actor.name,
            function_key: FN.GATE_CONFIGURE,
            description: `Denied: only the law firm owner can configure approval gates`,
            meta: { attempted: gate },
          }, ...prev.auditLog],
        };
      }
      const id = gate.id ?? uid("gate");
      const existing = prev.approvalGates.find(g => g.id === id);
      const next: ApprovalGate = { id, ...gate };
      const approvalGates = existing
        ? prev.approvalGates.map(g => g.id === id ? next : g)
        : [...prev.approvalGates, next];
      return {
        ...prev,
        approvalGates,
        auditLog: [{
          id: uid("aud"),
          ts: nowIso(),
          actor: prev.actor.name,
          function_key: FN.GATE_CONFIGURE,
          description: `${existing ? "Updated" : "Created"} approval gate for ${gate.function_key}${gate.departmentId ? ` (${gate.departmentId})` : " (firm-wide)"}; enabled=${gate.enabled}`,
          meta: { gate: next },
        }, ...prev.auditLog],
      };
    });
  }, []);

  const approvePending = useCallback((pendingId: string) => {
    setState(prev => {
      const p = prev.pending.find(x => x.id === pendingId);
      if (!p) return prev;
      // Apply the deferred payload now. Apply is keyed by function_key.
      let next: StoreState = {
        ...prev,
        pending: prev.pending.map(x => x.id === pendingId
          ? { ...x, status: "approved", resolvedBy: prev.actor.name, resolvedAt: nowIso() }
          : x),
      };
      next = applyApproved(next, p);
      next = {
        ...next,
        auditLog: [{
          id: uid("aud"),
          ts: nowIso(),
          actor: prev.actor.name,
          function_key: FN.PENDING_APPROVE,
          description: `Approved: ${p.description}`,
          meta: { pendingId, function_key: p.function_key },
        }, ...next.auditLog],
      };
      return next;
    });
  }, []);

  const rejectPending = useCallback((pendingId: string, reason?: string) => {
    setState(prev => {
      const p = prev.pending.find(x => x.id === pendingId);
      if (!p) return prev;
      return {
        ...prev,
        pending: prev.pending.map(x => x.id === pendingId
          ? { ...x, status: "rejected", resolvedBy: prev.actor.name, resolvedAt: nowIso(), rejectReason: reason }
          : x),
        auditLog: [{
          id: uid("aud"),
          ts: nowIso(),
          actor: prev.actor.name,
          function_key: FN.PENDING_REJECT,
          description: `Rejected: ${p.description}${reason ? ` — ${reason}` : ""}`,
          meta: { pendingId },
        }, ...prev.auditLog],
      };
    });
  }, []);

  // ─── Collections ─────────────────────────────────────────────────────────

  const pickNextCollectionsAccount = useCallback((): CollectionsAccount | null => {
    // Highest priority + oldest age — pump-through ordering. No effect; the
    // workspace UI tracks which one to show.
    const queued = state.collectionsQueue.filter(a => a.status === "queued");
    if (queued.length === 0) return null;
    const sorted = [...queued].sort((a, b) => {
      const pRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
      const pa = pRank[a.priority], pb = pRank[b.priority];
      if (pa !== pb) return pa - pb;
      return b.ageDays - a.ageDays;
    });
    return sorted[0] ?? null;
  }, [state.collectionsQueue]);

  const disposeCollections = useCallback((accountId: string, disposition: CollectionsDisposition, note?: string) => {
    setState(prev => {
      const acct = prev.collectionsQueue.find(a => a.id === accountId);
      const collectionsQueue = prev.collectionsQueue.map(a => a.id === accountId
        ? { ...a, status: (disposition === "no_answer" ? "queued" : "resolved") as CollectionsAccount["status"], lastContact: nowIso() }
        : a);
      const audit: AuditEntry = {
        id: uid("aud"),
        ts: nowIso(),
        actor: prev.actor.name,
        function_key: "collections.disposition",
        description: `Collections: ${acct?.clientName ?? accountId} → ${disposition}${note ? ` (${note})` : ""}`,
        meta: { accountId, disposition, note },
      };
      return { ...prev, collectionsQueue, auditLog: [audit, ...prev.auditLog] };
    });
  }, []);

  const api: StoreApi = useMemo(() => ({
    ...state,
    addStaff, removeStaff, updateStaff,
    addTask, removeTask, updateTask, setTaskPriority,
    setStrengthScore,
    setDepartmentSupervisor, setDepartmentHours,
    addTemplate, updateTemplate, removeTemplate,
    addKbDoc, toggleKbAuthorized, removeKbDoc,
    setGoal,
    upsertGate, approvePending, rejectPending,
    pickNextCollectionsAccount, disposeCollections,
    appendAudit,
  }), [
    state,
    addStaff, removeStaff, updateStaff,
    addTask, removeTask, updateTask, setTaskPriority,
    setStrengthScore, setDepartmentSupervisor, setDepartmentHours,
    addTemplate, updateTemplate, removeTemplate,
    addKbDoc, toggleKbAuthorized, removeKbDoc,
    setGoal, upsertGate, approvePending, rejectPending,
    pickNextCollectionsAccount, disposeCollections,
    appendAudit,
  ]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDepartmentStore(): StoreApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDepartmentStore must be used inside DepartmentManagementProvider");
  return v;
}

// ─── Applying an approved pending change ────────────────────────────────────
//
// Mirrors the apply()-blocks of each mutator above — used by approvePending
// to replay the deferred write on the current state.

function applyApproved(state: StoreState, pending: PendingChange): StoreState {
  const p = pending.payload as Record<string, unknown>;
  switch (pending.function_key) {
    case FN.STAFF_ADD:
      return { ...state, staff: [...state.staff, { id: uid("staff"), ...(p as Omit<StaffMember, "id">) }] };
    case FN.STAFF_REMOVE:
      return {
        ...state,
        staff: state.staff.filter(s => s.id !== p.id),
        scores: state.scores.filter(s => s.staffId !== p.id),
      };
    case FN.STAFF_UPDATE: {
      const { id, patch } = p as { id: string; patch: Partial<StaffMember> };
      return { ...state, staff: state.staff.map(s => s.id === id ? { ...s, ...patch } : s) };
    }
    case FN.TASK_ADD:
      return { ...state, tasks: [...state.tasks, { id: uid("tsk"), ...(p as Omit<DeptTask, "id">) }] };
    case FN.TASK_REMOVE:
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== p.id),
        scores: state.scores.filter(s => s.taskId !== p.id),
      };
    case FN.TASK_UPDATE: {
      const { id, patch } = p as { id: string; patch: Partial<DeptTask> };
      return { ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, ...patch } : t) };
    }
    case FN.TASK_UPDATE_PRIORITY: {
      const { id, priority } = p as { id: string; priority: Priority };
      return { ...state, tasks: state.tasks.map(t => t.id === id ? { ...t, priority } : t) };
    }
    case FN.SCORE_SET: {
      const sp = p as StrengthScore;
      const others = state.scores.filter(s =>
        !(s.staffId === sp.staffId && s.departmentId === sp.departmentId && s.taskId === sp.taskId)
      );
      return { ...state, scores: [...others, sp] };
    }
    case FN.DEPT_UPDATE_SUPERVISOR: {
      const { deptId, supervisorId } = p as { deptId: DepartmentId; supervisorId: string | null };
      return { ...state, departments: state.departments.map(d => d.id === deptId ? { ...d, supervisorId } : d) };
    }
    case FN.DEPT_UPDATE_HOURS: {
      const { deptId, hours } = p as { deptId: DepartmentId; hours: Department["hours"] };
      return { ...state, departments: state.departments.map(d => d.id === deptId ? { ...d, hours } : d) };
    }
    case FN.TEMPLATE_ADD:
      return { ...state, templates: [...state.templates, { id: uid("tmpl"), ...(p as Omit<ResponseTemplate, "id">) }] };
    case FN.TEMPLATE_UPDATE: {
      const { id, patch } = p as { id: string; patch: Partial<ResponseTemplate> };
      return { ...state, templates: state.templates.map(t => t.id === id ? { ...t, ...patch } : t) };
    }
    case FN.TEMPLATE_REMOVE:
      return { ...state, templates: state.templates.filter(t => t.id !== p.id) };
    case FN.KB_ADD:
      return { ...state, kbDocs: [...state.kbDocs, { id: uid("kb"), uploadedAt: nowIso(), ...(p as Omit<KBDoc, "id" | "uploadedAt">) }] };
    case FN.KB_TOGGLE_AUTHORIZED:
      return { ...state, kbDocs: state.kbDocs.map(d => d.id === p.id ? { ...d, authorizedForAi: !d.authorizedForAi } : d) };
    case FN.KB_REMOVE:
      return { ...state, kbDocs: state.kbDocs.filter(d => d.id !== p.id) };
    case FN.GOAL_SET: {
      const gp = p as Omit<Goal, "id">;
      const existingIdx = state.goals.findIndex(g =>
        g.staffId === gp.staffId
        && g.departmentId === gp.departmentId
        && g.metric === gp.metric
        && g.quarter === gp.quarter
        && g.year === gp.year
      );
      const next: Goal = { id: uid("goal"), ...gp };
      const goals = existingIdx >= 0
        ? state.goals.map((g, i) => i === existingIdx ? { ...g, value: gp.value } : g)
        : [...state.goals, next];
      return { ...state, goals };
    }
    default:
      return state;
  }
}

// Re-export the actor type for callers (the host passes an Actor in).
export type { Actor };

// Internal helpers used by surfaces other than the store itself —
// `goalQuarterAll` keeps the picker options enumerated in one place.
export const ALL_QUARTERS: GoalQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
