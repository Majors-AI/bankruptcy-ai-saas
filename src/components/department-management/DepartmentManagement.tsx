// Department Management — top-level container hosted inside SuperAdminConsole.
//
// Renders: department list (Intake / Accounting / Legal), portal-level staff
// roster columns, an active department panel (five-part), auto-assign tester,
// approval-gate panel, audit log, and the Collections workspace (when the
// active department is Accounting).
//
// Mirroring contract: every consumer here reads from the single in-memory
// store so edits surface immediately across surfaces. The same model will
// back the same UI when the store swaps to Supabase persistence (TODO notes
// throughout).

import { useState } from "react";
import {
  Building2, ScrollText, ShieldCheck, Activity, Coins,
} from "lucide-react";
import {
  DepartmentManagementProvider, useDepartmentStore,
  type Actor,
} from "./store";
import StaffRosterByTitle from "./StaffRosterByTitle";
import DepartmentPanel from "./DepartmentPanel";
import AutoAssignPanel from "./AutoAssignPanel";
import AuditLogView from "./AuditLogView";
import ApprovalGatesPanel from "./ApprovalGatesPanel";
import CollectionsWorkspace from "./CollectionsWorkspace";
import type { ViewerRole, DepartmentId } from "./types";

interface Props {
  viewerRole: ViewerRole;
  /** Required when viewerRole === 'department_supervisor' — restricts the
   *  department list to that supervisor's own department. */
  viewerDepartmentId?: DepartmentId | null;
  /** Optional actor identity for the audit stamp. Defaults to a stub. */
  actor?: Actor;
}

export default function DepartmentManagement({ viewerRole, viewerDepartmentId, actor }: Props) {
  return (
    <DepartmentManagementProvider actor={actor}>
      <Inner viewerRole={viewerRole} viewerDepartmentId={viewerDepartmentId ?? null} />
    </DepartmentManagementProvider>
  );
}

function Inner({ viewerRole, viewerDepartmentId }: { viewerRole: ViewerRole; viewerDepartmentId: DepartmentId | null }) {
  const store = useDepartmentStore();
  // Supervisor branch: scope the visible departments to their own. Super
  // admin + owner see all.
  const visible = (viewerRole === "department_supervisor" && viewerDepartmentId)
    ? store.departments.filter(d => d.id === viewerDepartmentId)
    : store.departments;
  const [active, setActive] = useState<DepartmentId>(visible[0]?.id ?? "intake");
  const activeDept = store.departments.find(d => d.id === active);

  // Top-level "view" — defaults to "departments" but the owner / super admin
  // can switch to Approval Gates / Audit Log without scrolling.
  const [view, setView] = useState<"departments" | "approvals" | "audit">("departments");

  const isOwnerOrSuper = viewerRole === "law_firm_owner" || viewerRole === "super_admin";

  return (
    <div className="space-y-5">
      {/* View tabs */}
      <div className="flex items-center gap-1 flex-wrap border border-[#2A2A28] bg-[#0F0F0E] rounded-lg p-1 w-fit">
        <ViewBtn active={view === "departments"} onClick={() => setView("departments")} icon={<Building2 className="w-3.5 h-3.5" />}>
          Departments
        </ViewBtn>
        {isOwnerOrSuper && (
          <ViewBtn active={view === "approvals"} onClick={() => setView("approvals")} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
            Approval gates
          </ViewBtn>
        )}
        <ViewBtn active={view === "audit"} onClick={() => setView("audit")} icon={<ScrollText className="w-3.5 h-3.5" />}>
          Audit log
        </ViewBtn>
      </div>

      {view === "audit" && <AuditLogView />}
      {view === "approvals" && <ApprovalGatesPanel viewerRole={viewerRole} />}

      {view === "departments" && (
        <>
          {/* Portal-level staff roster (super admin + owner only). */}
          {isOwnerOrSuper && (
            <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
              <StaffRosterByTitle viewerRole={viewerRole} />
            </div>
          )}

          {/* Department picker — list of cards. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {visible.map(d => (
              <button
                key={d.id}
                onClick={() => setActive(d.id)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  active === d.id
                    ? "border-amber-700 bg-amber-900/20"
                    : "border-[#2A2A28] bg-[#0F0F0E] hover:border-[#3A3A36]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-300" />
                  <p className="text-sm font-semibold text-[#FAFAF7]">{d.label}</p>
                </div>
                <p className="text-[10px] text-[#6B6B66]">
                  {store.staff.filter(s => s.departmentIds.includes(d.id)).length} members ·{" "}
                  {store.tasks.filter(t => t.departmentId === d.id).length} tasks
                </p>
              </button>
            ))}
          </div>

          {/* Active department's five-part panel */}
          {activeDept && (
            <DepartmentPanel
              department={activeDept}
              viewerRole={viewerRole}
              viewerDepartmentId={viewerDepartmentId}
            />
          )}

          {/* Auto-assign tester (always visible — works against active store) */}
          <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
            <AutoAssignPanel viewerRole={viewerRole} />
          </div>

          {/* Collections workspace — Accounting-only */}
          {activeDept?.id === "accounting" && (
            <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-amber-300" />
                <p className="text-sm font-semibold text-[#FAFAF7]">Collections (Accounting)</p>
                <Activity className="w-3 h-3 text-[#6B6B66]" />
              </div>
              <CollectionsWorkspace />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ViewBtn({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded ${
        active ? "bg-amber-700/40 text-amber-100 border border-amber-700" : "text-[#6B6B66] hover:text-white"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
