// Single-department page mounted from a child of the "Departments" left-nav
// group. The nav picks the active department; this component renders only
// that one's content (no in-page picker).
//
// Common to every dept: per-dept color scheme + DepartmentPanel +
// CaseTypeAssignment + ReassignmentRequests + AutoAssignPanel.
//
// Dept-specific (rendered only on the matching dept's page):
//   - intake     → IntakeRetentionPipeline
//   - accounting → CollectionsWorkspace
//   - legal      → LegalPrePostPanel

import { Building2 } from "lucide-react";
import { useDepartmentStore } from "../department-management/store";
import { useWhiteLabel, schemeCss } from "./whiteLabelStore";
import ColorSchemeEditor from "./ColorSchemeEditor";
import DepartmentPanel from "../department-management/DepartmentPanel";
import AutoAssignPanel from "../department-management/AutoAssignPanel";
import CollectionsWorkspace from "../department-management/CollectionsWorkspace";
import CaseTypeAssignmentSection from "./CaseTypeAssignment";
import ReassignmentRequestsSection from "./ReassignmentRequests";
import LegalPrePostPanel from "./LegalPrePostPanel";
import IntakeRetentionPipeline from "./IntakeRetentionPipeline";
import type { ViewerRole, DepartmentId } from "../department-management/types";

interface Props {
  /** Department this page is scoped to. Picked by the parent nav. */
  departmentId: DepartmentId;
  viewerRole: ViewerRole;
  viewerDepartmentId?: DepartmentId | null;
}

export default function DepartmentsPage({ departmentId, viewerRole, viewerDepartmentId }: Props) {
  const store = useDepartmentStore();
  const wl = useWhiteLabel();
  const dept = store.departments.find(d => d.id === departmentId);

  if (!dept) {
    return (
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-6">
        <p className="text-[12px] text-[#6B6B66]">Department <span className="font-mono">{departmentId}</span> not found.</p>
      </div>
    );
  }

  // Supervisor branch: deny access to departments other than the
  // supervisor's own. (Visibility is also enforced by the nav, but this
  // mirrors the contract at the page level.)
  if (viewerRole === "department_supervisor" && viewerDepartmentId && viewerDepartmentId !== departmentId) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-900/10 p-6">
        <p className="text-[12px] text-rose-200">You can only access the <strong>{viewerDepartmentId}</strong> department.</p>
      </div>
    );
  }

  const scheme = wl.resolveScheme(dept.id);

  return (
    <div style={schemeCss(scheme)} className="space-y-4">
      {/* Page header — names the department; the nav already conveys
          "Departments → X" so this is intentionally compact. */}
      <div className="rounded-xl border bg-[var(--lfs-surface)] p-5" style={{ borderColor: "var(--lfs-border)" }}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0F0F0E] border border-[var(--lfs-border)] flex items-center justify-center">
            <Building2 className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[#6B6B66]">Departments</p>
            <h2 className="text-base font-semibold text-[#FAFAF7]">{dept.label}</h2>
            <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
              {store.staff.filter(s => s.departmentIds.includes(dept.id)).length} members ·{" "}
              {store.tasks.filter(t => t.departmentId === dept.id).length} tasks ·{" "}
              {wl.departmentSchemes[dept.id] ? "custom color scheme" : "inherits global scheme"}
            </p>
          </div>
        </div>
      </div>

      {/* Per-department color scheme (mirrored to White Label). */}
      <section className="rounded-xl border bg-[var(--lfs-surface)] p-5" style={{ borderColor: "var(--lfs-border)" }}>
        <ColorSchemeEditor departmentId={dept.id} label={`${dept.label} color scheme`} />
      </section>

      {/* Core five-part department panel. */}
      <DepartmentPanel
        department={dept}
        viewerRole={viewerRole}
        viewerDepartmentId={viewerDepartmentId ?? null}
      />

      {/* Case-type assignment (scoped to this dept). */}
      <CaseTypeAssignmentSection departmentId={dept.id} viewerRole={viewerRole} />

      {/* Reassignment requests (this dept). */}
      <ReassignmentRequestsSection departmentId={dept.id} viewerRole={viewerRole} />

      {/* Department-specific extensions — render ONLY on the matching dept. */}
      {dept.id === "legal"      && <LegalPrePostPanel        viewerRole={viewerRole} />}
      {dept.id === "intake"     && <IntakeRetentionPipeline  viewerRole={viewerRole} />}
      {dept.id === "accounting" && (
        <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
          <CollectionsWorkspace />
        </div>
      )}

      {/* Auto-assign tester — runs against the active store; visible on every
          dept page so the supervisor / super admin can validate routing. */}
      <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
        <AutoAssignPanel viewerRole={viewerRole} />
      </div>
    </div>
  );
}
