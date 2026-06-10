// Staff Settings panel — extracted so two surfaces can mount the SAME UI:
//   1. SuperAdminConsole's Setting Portal — full-firm view for super admins
//      (continues to host the panel inside its "Staff Settings" Subsection).
//   2. MyScheduleTab in the staff dashboard — a NEW entry point that lets
//      DEPARTMENT SUPERVISORS who are NOT full super admins reach the same
//      panel, scoped to their own department.
//
// Read-only on the locked questionnaire — never touches it. No DB writes, no
// migrations, no fabricated data. Three scaffold blocks (Strength scores,
// Task assignments, Reporting) with disabled controls + TODO Phase B notes
// for persistence.
//
// ─── SCOPING ─────────────────────────────────────────────────────────────────
// `viewerStaffRole`:
//   - 'super_admin':           sees ALL departments / all staff. Reporting
//                              department picker is unlocked.
//   - 'department_supervisor': sees ONLY their own department. Reporting
//                              department picker is locked to viewerDepartment;
//                              the employee picker copy hints at scope ("your
//                              department only").
//
// TODO Phase B — REAL department-scoped enforcement:
//   - viewer.staff_role + viewer.department_id read from auth + the
//     `staff_department_supervisors` table at the controller level.
//   - For 'department_supervisor': filter every read (and every write
//     once persistence lands) to viewer.department_id; server-side
//     INSERT/UPDATE guard on `staff_strength_scores`,
//     `staff_task_assignments`, and the reporting aggregates RPC rejects
//     rows / queries that target staff outside the supervisor's department.
//   - For 'super_admin': no scope filter; full-firm visibility.
//   - This component currently relies on the host gate (caller decides
//     visibility); the gate notice at the top mirrors that contract so
//     future readers see the intended enforcement model.

import { Shield, Star, ClipboardList, Activity, Save } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StaffSettingsViewerRole = 'super_admin' | 'department_supervisor';

export interface StaffSettingsPanelProps {
  viewerStaffRole: StaffSettingsViewerRole;
  /** Required when viewerStaffRole === 'department_supervisor'; ignored for
   *  super_admin (who sees all departments). When omitted from a supervisor
   *  view, the picker falls back to a "— your department —" placeholder. */
  viewerDepartment?: string;
}

// ─── Local helper (mirrors SuperAdminConsole's ScaffoldField shape so the
//     two mount points look identical — no visual drift after extraction). ─

function ScaffoldField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StaffSettingsPanel({
  viewerStaffRole, viewerDepartment,
}: StaffSettingsPanelProps) {
  const isSupervisor = viewerStaffRole === 'department_supervisor';
  const dept = viewerDepartment ?? '— your department —';

  return (
    <>
      {/* Role-gate notice. The visibility itself is enforced one level up by
          the host (SuperAdminConsole renders its outer Subsection only for
          authorized viewers; MyScheduleTab renders the link only when the
          viewerStaffRole stub resolves to supervisor or super_admin). */}
      <div className="rounded-lg border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-2 mb-4">
        <div className="flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-[#B8945F] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#FAFAF7] leading-snug">
              {isSupervisor
                ? <>Gate — you see only your department: <span className="text-[#B8945F]">{dept}</span>. Other departments + firm-wide Setting Portal sections are not visible to you.</>
                : <>Gate — department_supervisor (own dept) · super_admin (all). You see all departments.</>}
            </p>
            <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-relaxed">
              {/* TODO Phase B — real role enforcement:
                  - read viewer.staff_role + viewer.department_id at controller level
                  - for department_supervisor: filter every read (and every write
                    below) to viewer.department_id; server-side INSERT/UPDATE guard
                    rejects rows targeting staff outside that department
                  - for super_admin: no scope filter; full-firm visibility
                  - for all other roles: the entry point host MUST NOT render this
                    panel — drive that from the nav/dashboard gate so non-supervisors
                    never reach this surface */}
              Viewer role: <span className="font-semibold text-[#FAFAF7]">{viewerStaffRole}</span>.
              Real role enforcement + department scoping land with the staff-setup model.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── 1) Strength scores ─────────────────────────────────── */}
        <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-3.5 h-3.5 text-[#B8945F]" />
            <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
              Strength scores
            </p>
            <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
              Coming soon — reminder to design
            </span>
          </div>
          <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
            Per-employee strength rating against firm-defined skill categories
            (e.g. "client phone manner", "document review", "calendar accuracy",
            "intake conversion"). Supervisors maintain scores for their own
            department; super admins for any. No defaulted values — scores stay
            blank until a supervisor records one.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
            <ScaffoldField label={isSupervisor ? `Employee (${dept})` : 'Employee'}>
              <select
                disabled
                className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>{isSupervisor ? `— pick employee from ${dept} —` : '— pick employee —'}</option>
              </select>
            </ScaffoldField>
            <ScaffoldField label="Skill category">
              <select
                disabled
                className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>— pick category —</option>
              </select>
            </ScaffoldField>
            <ScaffoldField label="Score (1-5)">
              <input
                disabled
                type="text"
                placeholder="—"
                className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed placeholder-[#3A3A36]"
              />
            </ScaffoldField>
          </div>
          <button
            disabled
            title="Save score — persistence not wired"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B6B66] border border-dashed border-[#3A3A36] px-2 py-1 rounded cursor-not-allowed opacity-70"
          >
            <Save className="w-3 h-3" /> Save score
          </button>

          <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
            {/* TODO Phase B — strength score storage:
                - new table `staff_strength_scores (id, firm_id, staff_id,
                  category_id, score (1-5 int), set_by, set_at, notes)`
                - companion `firm_strength_categories (id, firm_id, label,
                  description, retired_at)` — supervisors define the categories
                  scoped to their department
                - keep history on every update; chart consumers read the latest
                  per (staff, category)
                - INSERT/UPDATE guard rejects writes where staff_id sits outside
                  viewer's department (super admin bypasses) */}
            Reference only. No fabricated scores — values surface only when
            supervisors record them against the planned
            <code className="font-mono text-[#FAFAF7]"> staff_strength_scores </code>
            table.
          </p>
        </div>

        {/* ── 2) Task assignments ────────────────────────────────── */}
        <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-3.5 h-3.5 text-[#B8945F]" />
            <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
              Task assignments
            </p>
            <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
              Coming soon — reminder to design
            </span>
          </div>
          <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
            Per-employee task assignments — which intake/admin tasks they handle
            (e.g. "answer inbound calls", "review intake packets", "schedule
            consults", "follow up on stale leads"). Drives the routing of the
            "My Tasks" surface on the dashboard.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <ScaffoldField label={isSupervisor ? `Employee (${dept})` : 'Employee'}>
              <select
                disabled
                className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>{isSupervisor ? `— pick employee from ${dept} —` : '— pick employee —'}</option>
              </select>
            </ScaffoldField>
            <ScaffoldField label={isSupervisor ? `Tasks (${dept} catalog)` : 'Tasks'}>
              <select
                disabled
                multiple
                className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>— pick task(s) —</option>
              </select>
            </ScaffoldField>
          </div>
          <button
            disabled
            title="Save assignments — persistence not wired"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B6B66] border border-dashed border-[#3A3A36] px-2 py-1 rounded cursor-not-allowed opacity-70"
          >
            <Save className="w-3 h-3" /> Save assignments
          </button>

          <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
            {/* TODO Phase B — task assignment storage:
                - new table `staff_task_assignments (staff_id, task_key,
                  assigned_by, assigned_at, retired_at)` — many-to-many
                  between staff_members and a firm-level task catalog
                - companion `firm_task_catalog (id, firm_id, key, label,
                  description, department_id)` — supervisors define the
                  catalog scoped to their department
                - assignment drives the "My Tasks" surface and influences
                  task routing in the dashboard (the same routing the
                  existing My Tasks rework consumes)
                - INSERT/UPDATE guard same as strength scores:
                  department-scoped for supervisors, full-firm for super
                  admins */}
            Reference only. Persistence + the task catalog land with the
            staff-setup model. The dashboard's "My Tasks" surface already exists in
            scaffold form; these assignments will drive what shows up there.
          </p>
        </div>

        {/* ── 3) Reporting ───────────────────────────────────────── */}
        <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-[#B8945F]" />
            <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
              Reporting
            </p>
            <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
              Coming soon — reminder to design
            </span>
          </div>
          <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
            Department-scoped metrics + per-employee rollups only supervisors and
            super admins see. Distinct from the firm-wide Performance Goals
            subsection — Reporting answers "how is my department doing right
            now?" rather than "did this employee hit their quarterly target?".
          </p>

          {/* Filter row — supervisor: department locked. super_admin: free. */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <ScaffoldField label="Department">
              <select
                disabled
                // When the viewer is a department supervisor, the picker is
                // visually locked to their own department. The real implementation
                // will hard-filter the underlying aggregates query — this select
                // just communicates intent today.
                value={isSupervisor ? dept : ''}
                onChange={() => { /* disabled — scaffold */ }}
                className={`bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed ${
                  isSupervisor ? 'border-[#B8945F]/40 text-[#B8945F]' : ''
                }`}
              >
                {isSupervisor
                  ? <option value={dept}>{dept} (locked to your department)</option>
                  : <option value="">— pick department —</option>}
              </select>
            </ScaffoldField>
            <ScaffoldField label="Employee">
              <select
                disabled
                className="bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>{isSupervisor ? `— all in ${dept} / pick —` : '— all / pick —'}</option>
              </select>
            </ScaffoldField>
            <ScaffoldField label="Time window">
              <select
                disabled
                className="bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
              >
                <option>— pick window —</option>
              </select>
            </ScaffoldField>
          </div>

          {/* Empty state — NO fabricated numbers, NO fake bars / sparklines. */}
          <div className="rounded border border-[#2A2A28] bg-[#1A1A18] flex items-center justify-center" style={{ height: 200 }}>
            <div className="text-center px-4">
              <Activity className="w-6 h-6 text-[#3A3A36] mx-auto mb-1.5" />
              <p className="text-[11px] text-[#6B6B66] italic">
                No report data yet.
              </p>
              <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-snug max-w-xs">
                {isSupervisor
                  ? `Wire the metrics backend and ${dept} rollups appear here. Nothing fabricated — empty until the data exists.`
                  : 'Wire the metrics backend and the department / employee rollups appear here. Nothing fabricated — empty until the data exists.'}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
            {/* TODO Phase B — reporting data source:
                - read aggregates derived from intake_contact_log,
                  intake_leads status transitions, calendar_events,
                  staff_strength_scores, and task-assignment outcomes
                  once the catalog exists
                - department-scope filter enforced server-side:
                  supervisors only receive aggregates over their own
                  department; super admins may select any
                - cache rollups; refresh on a cadence rather than on
                  every read
                - charting: same lightweight inline SVG approach as the
                  Performance Goals chart — no chart-lib dep */}
            Reference only. Aggregates populate from the same metrics backend the
            Performance Goals subsection consumes, plus the per-supervisor scope filter.
          </p>
        </div>

      </div>
    </>
  );
}
