// Department Panel — five-tab surface per department: Team members, Tasks,
// Strength scores, Department settings, Reporting.
//
// Permission contract:
//   - law_firm_owner + super_admin: everything editable for every department.
//   - department_supervisor (scoped to their own dept): everything in their
//     own department; otherwise the host gates the panel away. The tab
//     surface itself doesn't re-check the department gate — the parent
//     DepartmentManagement decides which department to mount.
//   - non-lawyer staff: cannot edit attorney/lawyer tasks (DeptTask.lawyerOnly)
//     or any rules (exemptions, BK code, IRS standards). Read-only on those.

import { useState } from "react";
import { Users, ListTodo, Star, Settings, Activity } from "lucide-react";
import type { Department, ViewerRole } from "./types";
import TeamMembersSection from "./sections/TeamMembersSection";
import TasksSection from "./sections/TasksSection";
import StrengthScoresSection from "./sections/StrengthScoresSection";
import DeptSettingsSection from "./sections/DeptSettingsSection";
import ReportingSection from "./sections/ReportingSection";

type TabKey = "team" | "tasks" | "scores" | "settings" | "reporting";

interface Props {
  department: Department;
  viewerRole: ViewerRole;
  /** Department supervisor's own department id. Used to scope visibility on
   *  the supervisor branch. */
  viewerDepartmentId?: string | null;
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof Users }> = [
  { key: "team",      label: "Team members",         icon: Users },
  { key: "tasks",     label: "Tasks",                icon: ListTodo },
  { key: "scores",    label: "Strength scores",      icon: Star },
  { key: "settings",  label: "Department settings",  icon: Settings },
  { key: "reporting", label: "Per-employee reporting", icon: Activity },
];

export default function DepartmentPanel({ department, viewerRole, viewerDepartmentId }: Props) {
  const [tab, setTab] = useState<TabKey>("team");

  return (
    <div className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2A2A28] flex items-center justify-between">
        <p className="text-sm font-semibold text-[#FAFAF7]">
          {department.label} <span className="text-[#6B6B66] font-normal text-xs">· department panel</span>
        </p>
        <span className="text-[10px] uppercase tracking-widest text-[#6B6B66]">
          {viewerRole.replace(/_/g, " ")}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 px-2 py-2 border-b border-[#2A2A28]">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded ${
                active
                  ? "bg-amber-700/40 text-amber-100 border border-amber-700"
                  : "text-[#6B6B66] hover:text-white border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-4">
        {tab === "team"      && <TeamMembersSection department={department} viewerRole={viewerRole} />}
        {tab === "tasks"     && <TasksSection      department={department} viewerRole={viewerRole} />}
        {tab === "scores"    && <StrengthScoresSection department={department} viewerRole={viewerRole} />}
        {tab === "settings"  && <DeptSettingsSection department={department} viewerRole={viewerRole} viewerDepartmentId={viewerDepartmentId} />}
        {tab === "reporting" && <ReportingSection  department={department} viewerRole={viewerRole} />}
      </div>
    </div>
  );
}
