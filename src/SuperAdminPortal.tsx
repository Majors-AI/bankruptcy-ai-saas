import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  BarChart2,
  FileText,
  Lightbulb,
  Filter,
  CheckSquare,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json().catch(() => null);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffTask {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_role: string;
  task_date: string;
  title: string;
  priority: string;
  status: string;
  due_time: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  source: string;
  client_name: string | null;
}

interface ProductivityLog {
  id: string;
  staff_id: string;
  staff_name: string;
  log_date: string;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_skipped: number;
  tasks_overdue: number;
  total_time_logged_minutes: number;
  avg_response_time_minutes: number;
  client_contacts_handled: number;
  notes: string | null;
}

interface BehaviorNote {
  id: string;
  staff_id: string;
  staff_name: string;
  recorded_by: string;
  behavior_type:
    | "late_task"
    | "missed_reminder"
    | "quick_completion"
    | "high_volume"
    | "quality_flag"
    | "escalation"
    | "positive"
    | "manual"
    | "client_complaint"
    | "client_compliment";
  description: string;
  severity: "info" | "warning" | "positive";
  week_of: string;
  created_at: string;
}

interface ImprovementSuggestion {
  id: string;
  staff_id: string;
  staff_name: string;
  week_of: string;
  suggestions: string[];
  generated_by: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

type TabKey = "today" | "week" | "behavior" | "suggestions";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  attorney: "bg-amber-900/60 text-amber-300 border border-amber-700",
  paralegal: "bg-emerald-900/60 text-emerald-300 border border-emerald-700",
  legal_admin: "bg-sky-900/60 text-sky-300 border border-sky-700",
  accounting_admin: "bg-teal-900/60 text-teal-300 border border-teal-700",
  attorney_owner: "bg-red-900/60 text-red-300 border border-red-700",
};

const BEHAVIOR_LABEL: Record<string, string> = {
  late_task: "Late Task",
  missed_reminder: "Missed Reminder",
  quick_completion: "Quick Completion",
  high_volume: "High Volume",
  quality_flag: "Quality Flag",
  escalation: "Escalation",
  positive: "Positive",
  manual: "Manual Note",
  client_complaint: "Client Complaint",
  client_compliment: "Client Compliment",
};

const SEVERITY_STYLE: Record<string, string> = {
  positive: "bg-emerald-900/50 text-emerald-300 border border-emerald-700",
  info: "bg-sky-900/50 text-sky-300 border border-sky-700",
  warning: "bg-amber-900/50 text-amber-300 border border-amber-700",
};

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-slate-400",
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function weekEnd(date = new Date()) {
  const ws = new Date(weekStart(date));
  ws.setDate(ws.getDate() + 6);
  return ws.toISOString().split("T")[0];
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function generateSuggestionsFromNotes(notes: BehaviorNote[]): string[] {
  const types = notes.map((n) => n.behavior_type);
  const suggestions: string[] = [];

  if (types.includes("late_task")) {
    suggestions.push(
      "Review task prioritization — multiple late tasks detected this week. Consider time-blocking mornings for high-priority items."
    );
  }
  if (types.includes("missed_reminder")) {
    suggestions.push(
      "Enable desktop notifications or set recurring calendar reminders to reduce missed follow-ups."
    );
  }
  if (types.includes("quality_flag")) {
    suggestions.push(
      "Quality flags were raised this week. Schedule a brief review session with a senior team member to clarify standards."
    );
  }
  if (types.includes("client_complaint")) {
    suggestions.push(
      "Client complaint(s) recorded — review communication tone and response timeliness. Consider a client service refresher."
    );
  }
  if (types.includes("escalation")) {
    suggestions.push(
      "Escalations occurred this week. Identify the root cause and document escalation triggers for future prevention."
    );
  }
  if (types.includes("quick_completion")) {
    suggestions.push(
      "Strong quick completion rate noted — consider mentoring junior staff or taking on stretch assignments."
    );
  }
  if (types.includes("high_volume")) {
    suggestions.push(
      "High task volume handled this week — excellent throughput. Ensure sustainable pace to avoid burnout."
    );
  }
  if (types.includes("client_compliment")) {
    suggestions.push(
      "Client compliment received — keep up the excellent client communication and service delivery."
    );
  }
  if (types.includes("positive")) {
    suggestions.push(
      "Positive behavior noted by management. Continue building on these strengths."
    );
  }
  if (suggestions.length === 0) {
    suggestions.push(
      "No significant patterns detected this week. Maintain current performance and stay proactive with task management."
    );
  }
  return suggestions;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_BADGE[role] ?? "bg-slate-700 text-slate-300 border border-slate-600";
  const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function ProgressBar({ value, max, color = "bg-emerald-500" }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#0b1220] border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-xl ${accent ?? "bg-slate-700/50"}`}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold text-white leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Assign Task Modal ────────────────────────────────────────────────────────

interface AssignTaskModalProps {
  staffId: string;
  staffName: string;
  onClose: () => void;
  onSaved: () => void;
}

function AssignTaskModal({ staffId, staffName, onClose, onSaved }: AssignTaskModalProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueTime, setDueTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await sbFetch("staff_daily_tasks", {
        method: "POST",
        body: JSON.stringify({
          staff_id: staffId,
          staff_name: staffName,
          task_date: todayStr(),
          title: title.trim(),
          priority,
          status: "pending",
          due_time: dueTime || null,
          client_name: clientName.trim() || null,
          estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          source: "superadmin",
        }),
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0b1220] border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="text-white font-semibold text-lg">Assign Task</div>
            <div className="text-slate-500 text-sm mt-0.5">Assigning to {staffName}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Review client documents"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
                Due Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
              Client Name (optional)
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name if applicable"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
              Estimated Minutes (optional)
            </label>
            <input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="e.g. 30"
              min={1}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Assign Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Behavior Note Modal ──────────────────────────────────────────────────

interface AddBehaviorNoteModalProps {
  staffList: { staff_id: string; staff_name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function AddBehaviorNoteModal({ staffList, onClose, onSaved }: AddBehaviorNoteModalProps) {
  const [staffId, setStaffId] = useState(staffList[0]?.staff_id ?? "");
  const [behaviorType, setBehaviorType] = useState<BehaviorNote["behavior_type"]>("manual");
  const [severity, setSeverity] = useState<BehaviorNote["severity"]>("info");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStaff = staffList.find((s) => s.staff_id === staffId);

  async function handleSave() {
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await sbFetch("staff_behavior_notes", {
        method: "POST",
        body: JSON.stringify({
          staff_id: staffId,
          staff_name: selectedStaff?.staff_name ?? "",
          recorded_by: "Superadmin",
          behavior_type: behaviorType,
          description: description.trim(),
          severity,
          week_of: weekStart(),
        }),
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0b1220] border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="text-white font-semibold text-lg">Add Behavior Note</div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
              Staff Member
            </label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors"
            >
              {staffList.map((s) => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.staff_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
                Type
              </label>
              <select
                value={behaviorType}
                onChange={(e) => setBehaviorType(e.target.value as BehaviorNote["behavior_type"])}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors"
              >
                {Object.entries(BEHAVIOR_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BehaviorNote["severity"])}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="positive">Positive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wide block mb-1.5">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the behavior..."
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors resize-none"
            />
          </div>
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Add Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────

interface TodayTabProps {
  tasks: StaffTask[];
  onRefresh: () => void;
}

function TodayTab({ tasks, onRefresh }: TodayTabProps) {
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<{ staffId: string; staffName: string } | null>(null);

  // Group by staff
  const staffMap = new Map<string, { staff_id: string; staff_name: string; staff_role: string; tasks: StaffTask[] }>();
  for (const t of tasks) {
    if (!staffMap.has(t.staff_id)) {
      staffMap.set(t.staff_id, { staff_id: t.staff_id, staff_name: t.staff_name, staff_role: t.staff_role, tasks: [] });
    }
    staffMap.get(t.staff_id)!.tasks.push(t);
  }
  const staffList = Array.from(staffMap.values()).sort((a, b) => a.staff_name.localeCompare(b.staff_name));

  function getCardColor(tasks: StaffTask[]) {
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const urgentOverdue = tasks.filter((t) => t.status === "overdue" && t.priority === "urgent").length;
    if (urgentOverdue >= 2) return "border-red-700/60 bg-red-950/10";
    if (overdue > 0) return "border-amber-700/60 bg-amber-950/10";
    return "border-slate-800 bg-[#0b1220]";
  }

  function getBarColor(tasks: StaffTask[]) {
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const urgentOverdue = tasks.filter((t) => t.status === "overdue" && t.priority === "urgent").length;
    if (urgentOverdue >= 2) return "bg-red-500";
    if (overdue > 0) return "bg-amber-500";
    return "bg-emerald-500";
  }

  return (
    <>
      {staffList.length === 0 ? (
        <div className="text-center text-slate-500 py-20 text-sm">No task data found for today.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {staffList.map((s) => {
            const total = s.tasks.length;
            const completed = s.tasks.filter((t) => t.status === "completed").length;
            const overdue = s.tasks.filter((t) => t.status === "overdue").length;
            const inProgress = s.tasks.filter((t) => t.status === "in_progress").length;
            const isExpanded = expandedStaff === s.staff_id;

            return (
              <div
                key={s.staff_id}
                className={`border rounded-2xl overflow-hidden transition-all duration-200 ${getCardColor(s.tasks)}`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold text-sm truncate">{s.staff_name}</div>
                      <div className="mt-1">
                        <RoleBadge role={s.staff_role} />
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setAssignModal({ staffId: s.staff_id, staffName: s.staff_name })
                      }
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/50 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Plus size={12} />
                      Assign
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-800/40 rounded-xl px-3 py-2 text-center">
                      <div className="text-white font-bold text-lg leading-tight">{total}</div>
                      <div className="text-slate-500 text-[10px] uppercase tracking-wide">Total</div>
                    </div>
                    <div className="bg-emerald-900/20 rounded-xl px-3 py-2 text-center">
                      <div className="text-emerald-400 font-bold text-lg leading-tight">{completed}</div>
                      <div className="text-slate-500 text-[10px] uppercase tracking-wide">Done</div>
                    </div>
                    <div className={`rounded-xl px-3 py-2 text-center ${overdue > 0 ? "bg-red-900/20" : "bg-slate-800/40"}`}>
                      <div className={`font-bold text-lg leading-tight ${overdue > 0 ? "text-red-400" : "text-slate-400"}`}>
                        {overdue}
                      </div>
                      <div className="text-slate-500 text-[10px] uppercase tracking-wide">Overdue</div>
                    </div>
                  </div>

                  <div className="mb-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-500">
                        {total === 0 ? "0%" : `${Math.round((completed / total) * 100)}%`} complete
                      </span>
                      {inProgress > 0 && (
                        <span className="text-[10px] text-sky-400 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          {inProgress} active
                        </span>
                      )}
                    </div>
                    <ProgressBar value={completed} max={total} color={getBarColor(s.tasks)} />
                  </div>
                </div>

                <button
                  onClick={() => setExpandedStaff(isExpanded ? null : s.staff_id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-300 border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      Hide Tasks <ChevronUp size={13} />
                    </>
                  ) : (
                    <>
                      View Tasks <ChevronDown size={13} />
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800/60 divide-y divide-slate-800/40">
                    {s.tasks.length === 0 ? (
                      <div className="px-5 py-4 text-slate-600 text-xs text-center">No tasks today.</div>
                    ) : (
                      s.tasks
                        .sort((a, b) => {
                          const order = ["overdue", "in_progress", "pending", "completed", "skipped"];
                          return order.indexOf(a.status) - order.indexOf(b.status);
                        })
                        .map((task) => (
                          <div key={task.id} className="px-5 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{task.title}</div>
                                {task.client_name && (
                                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                                    {task.client_name}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[10px] font-semibold capitalize ${PRIORITY_STYLE[task.priority] ?? "text-slate-400"}`}>
                                  {task.priority}
                                </span>
                                <StatusBadge status={task.status} />
                              </div>
                            </div>
                            {task.due_time && (
                              <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                                <Clock size={9} />
                                Due {task.due_time}
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assignModal && (
        <AssignTaskModal
          staffId={assignModal.staffId}
          staffName={assignModal.staffName}
          onClose={() => setAssignModal(null)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-900/50 text-emerald-300",
    in_progress: "bg-sky-900/50 text-sky-300",
    overdue: "bg-red-900/50 text-red-300",
    pending: "bg-slate-700/50 text-slate-400",
    skipped: "bg-slate-700/50 text-slate-500",
  };
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${map[status] ?? "bg-slate-700/50 text-slate-400"}`}>
      {label}
    </span>
  );
}

// ─── Week Tab ─────────────────────────────────────────────────────────────────

type SortField = "staff_name" | "completion_rate" | "total_completed" | "total_time";
type SortDir = "asc" | "desc";

interface WeekTabProps {
  logs: ProductivityLog[];
}

function WeekTab({ logs }: WeekTabProps) {
  const [sortField, setSortField] = useState<SortField>("completion_rate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const ws = weekStart();
  const we = weekEnd();
  const weekDays: string[] = [];
  for (let d = new Date(ws + "T00:00:00"); d <= new Date(we + "T00:00:00"); d.setDate(d.getDate() + 1)) {
    weekDays.push(d.toISOString().split("T")[0]);
  }
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Group by staff
  const staffMap = new Map<
    string,
    { staff_id: string; staff_name: string; byDay: Map<string, ProductivityLog>; totalCompleted: number; totalAssigned: number; totalTime: number }
  >();

  for (const log of logs) {
    if (!staffMap.has(log.staff_id)) {
      staffMap.set(log.staff_id, {
        staff_id: log.staff_id,
        staff_name: log.staff_name,
        byDay: new Map(),
        totalCompleted: 0,
        totalAssigned: 0,
        totalTime: 0,
      });
    }
    const entry = staffMap.get(log.staff_id)!;
    entry.byDay.set(log.log_date, log);
    entry.totalCompleted += log.tasks_completed ?? 0;
    entry.totalAssigned += log.tasks_assigned ?? 0;
    entry.totalTime += log.total_time_logged_minutes ?? 0;
  }

  let rows = Array.from(staffMap.values()).map((s) => ({
    ...s,
    completion_rate: s.totalAssigned === 0 ? 0 : Math.round((s.totalCompleted / s.totalAssigned) * 100),
  }));

  rows.sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortField === "staff_name") {
      av = a.staff_name;
      bv = b.staff_name;
    } else if (sortField === "completion_rate") {
      av = a.completion_rate;
      bv = b.completion_rate;
    } else if (sortField === "total_completed") {
      av = a.totalCompleted;
      bv = b.totalCompleted;
    } else {
      av = a.totalTime;
      bv = b.totalTime;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-slate-700">↕</span>;
    return <span className="text-indigo-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  if (rows.length === 0) {
    return <div className="text-center text-slate-500 py-20 text-sm">No productivity logs found for this week.</div>;
  }

  return (
    <div className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          Week of <span className="text-white font-medium">{formatDate(ws)}</span> — {formatDate(we)}
        </div>
        <div className="text-xs text-slate-600">{rows.length} staff members</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
              <th
                className="px-5 py-3 text-left cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => toggleSort("staff_name")}
              >
                Staff <SortIcon field="staff_name" />
              </th>
              {dayLabels.map((d, i) => (
                <th key={i} className="px-3 py-3 text-center w-16">
                  {d}
                </th>
              ))}
              <th
                className="px-4 py-3 text-center cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => toggleSort("total_completed")}
              >
                Total <SortIcon field="total_completed" />
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => toggleSort("completion_rate")}
              >
                Rate <SortIcon field="completion_rate" />
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => toggleSort("total_time")}
              >
                Time <SortIcon field="total_time" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row) => (
              <tr key={row.staff_id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-5 py-3 font-medium text-white whitespace-nowrap">{row.staff_name}</td>
                {weekDays.map((day) => {
                  const log = row.byDay.get(day);
                  const rate = log && log.tasks_assigned > 0
                    ? Math.round((log.tasks_completed / log.tasks_assigned) * 100)
                    : null;
                  return (
                    <td key={day} className="px-3 py-3 text-center">
                      {log ? (
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`text-xs font-semibold ${
                              rate === null ? "text-slate-600" : rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400"
                            }`}
                          >
                            {log.tasks_completed}/{log.tasks_assigned}
                          </span>
                          <div className="w-8">
                            <ProgressBar
                              value={log.tasks_completed}
                              max={log.tasks_assigned}
                              color={
                                rate === null ? "bg-slate-600" : rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500"
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center font-semibold text-white">{row.totalCompleted}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`text-xs font-bold ${
                        row.completion_rate >= 80 ? "text-emerald-400" : row.completion_rate >= 50 ? "text-amber-400" : "text-red-400"
                      }`}
                    >
                      {row.completion_rate}%
                    </span>
                    <div className="w-12">
                      <ProgressBar
                        value={row.completion_rate}
                        max={100}
                        color={row.completion_rate >= 80 ? "bg-emerald-500" : row.completion_rate >= 50 ? "bg-amber-500" : "bg-red-500"}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-slate-400 text-xs whitespace-nowrap">
                  {row.totalTime > 0 ? `${Math.floor(row.totalTime / 60)}h ${row.totalTime % 60}m` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Behavior Notes Tab ───────────────────────────────────────────────────────

interface BehaviorTabProps {
  notes: BehaviorNote[];
  staffList: { staff_id: string; staff_name: string }[];
  onRefresh: () => void;
}

function BehaviorTab({ notes, staffList, onRefresh }: BehaviorTabProps) {
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = notes.filter((n) => {
    if (filterStaff !== "all" && n.staff_id !== filterStaff) return false;
    if (filterSeverity !== "all" && n.severity !== filterSeverity) return false;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={14} />
          <span className="text-xs uppercase tracking-wide">Filter:</span>
        </div>
        <select
          value={filterStaff}
          onChange={(e) => setFilterStaff(e.target.value)}
          className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500"
        >
          <option value="all">All Staff</option>
          {staffList.map((s) => (
            <option key={s.staff_id} value={s.staff_id}>
              {s.staff_name}
            </option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500"
        >
          <option value="all">All Severities</option>
          <option value="positive">Positive</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
        </select>
        <button
          onClick={() => setShowAddModal(true)}
          className="ml-auto flex items-center gap-1.5 text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors font-semibold"
        >
          <Plus size={13} />
          Add Note
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-slate-500 py-20 text-sm">No behavior notes found.</div>
      ) : (
        <div className="space-y-3">
          {sorted.map((note) => (
            <div key={note.id} className="bg-[#0b1220] border border-slate-800 rounded-2xl px-5 py-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-white font-semibold text-sm">{note.staff_name}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${SEVERITY_STYLE[note.severity]}`}>
                      {note.severity}
                    </span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-medium bg-slate-700/60 text-slate-300 border border-slate-600">
                      {BEHAVIOR_LABEL[note.behavior_type] ?? note.behavior_type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{note.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500">
                    {new Date(note.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">by {note.recorded_by}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Week of {formatDate(note.week_of)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBehaviorNoteModal
          staffList={staffList}
          onClose={() => setShowAddModal(false)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}

// ─── Improvement Suggestions Tab ─────────────────────────────────────────────

interface SuggestionsTabProps {
  suggestions: ImprovementSuggestion[];
  behaviorNotes: BehaviorNote[];
  staffList: { staff_id: string; staff_name: string }[];
  onRefresh: () => void;
}

function SuggestionsTab({ suggestions, behaviorNotes, staffList, onRefresh }: SuggestionsTabProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Group by staff
  const byStaff = new Map<string, { staff_id: string; staff_name: string; suggestions: ImprovementSuggestion[] }>();
  for (const s of staffList) {
    byStaff.set(s.staff_id, { staff_id: s.staff_id, staff_name: s.staff_name, suggestions: [] });
  }
  for (const sug of suggestions) {
    if (!byStaff.has(sug.staff_id)) {
      byStaff.set(sug.staff_id, { staff_id: sug.staff_id, staff_name: sug.staff_name, suggestions: [] });
    }
    byStaff.get(sug.staff_id)!.suggestions.push(sug);
  }
  const staffEntries = Array.from(byStaff.values()).sort((a, b) => a.staff_name.localeCompare(b.staff_name));

  async function handleGenerate(staffId: string, staffName: string) {
    setGenerating(staffId);
    setErrors((e) => ({ ...e, [staffId]: "" }));
    try {
      const ws = weekStart();
      const weekNotes = behaviorNotes.filter((n) => n.staff_id === staffId && n.week_of === ws);
      const sugList = generateSuggestionsFromNotes(weekNotes);
      await sbFetch("staff_improvement_suggestions", {
        method: "POST",
        body: JSON.stringify({
          staff_id: staffId,
          staff_name: staffName,
          week_of: ws,
          suggestions: sugList,
          generated_by: "superadmin",
          acknowledged: false,
          acknowledged_at: null,
        }),
      });
      onRefresh();
    } catch (e: unknown) {
      setErrors((err) => ({
        ...err,
        [staffId]: e instanceof Error ? e.message : "Generation failed.",
      }));
    } finally {
      setGenerating(null);
    }
  }

  async function handleAcknowledge(suggestionId: string, staffId: string) {
    setAcknowledging(suggestionId);
    try {
      await sbFetch(`staff_improvement_suggestions?id=eq.${suggestionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        }),
      });
      onRefresh();
    } catch (e: unknown) {
      setErrors((err) => ({
        ...err,
        [staffId]: e instanceof Error ? e.message : "Acknowledge failed.",
      }));
    } finally {
      setAcknowledging(null);
    }
  }

  return (
    <div className="space-y-5">
      {staffEntries.map((s) => {
        const sorted = [...s.suggestions].sort(
          (a, b) => new Date(b.week_of).getTime() - new Date(a.week_of).getTime()
        );
        const currentWeek = weekStart();
        const hasCurrentWeek = sorted.some((sg) => sg.week_of === currentWeek);

        return (
          <div key={s.staff_id} className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="font-semibold text-white">{s.staff_name}</div>
              <div className="flex items-center gap-2">
                {errors[s.staff_id] && (
                  <span className="text-xs text-red-400">{errors[s.staff_id]}</span>
                )}
                {!hasCurrentWeek && (
                  <button
                    onClick={() => handleGenerate(s.staff_id, s.staff_name)}
                    disabled={generating === s.staff_id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lightbulb size={12} />
                    {generating === s.staff_id ? "Generating..." : "Generate Suggestions"}
                  </button>
                )}
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="px-5 py-6 text-slate-600 text-sm text-center">
                No improvement suggestions yet. Click "Generate Suggestions" to create them.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {sorted.map((sg) => (
                  <div key={sg.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">
                          Week of <span className="text-slate-300">{formatDate(sg.week_of)}</span>
                        </div>
                        <div className="text-xs text-slate-600">Generated by {sg.generated_by}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sg.acknowledged ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <CheckCircle size={13} />
                            <span>
                              Acknowledged{" "}
                              {sg.acknowledged_at &&
                                new Date(sg.acknowledged_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAcknowledge(sg.id, s.staff_id)}
                            disabled={acknowledging === sg.id}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckSquare size={12} />
                            {acknowledging === sg.id ? "Saving..." : "Mark Acknowledged"}
                          </button>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {sg.suggestions.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                          <span className="text-sm text-slate-300 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminPortal() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [todayTasks, setTodayTasks] = useState<StaffTask[]>([]);
  const [weekLogs, setWeekLogs] = useState<ProductivityLog[]>([]);
  const [behaviorNotes, setBehaviorNotes] = useState<BehaviorNote[]>([]);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayStr();
  const ws = weekStart();
  const we = weekEnd();

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [tasks, logs, notes, suggs] = await Promise.all([
        sbFetch(`staff_daily_tasks?task_date=eq.${today}&order=staff_name.asc,due_time.asc`),
        sbFetch(`staff_productivity_log?log_date=gte.${ws}&log_date=lte.${we}&order=log_date.asc`),
        sbFetch(`staff_behavior_notes?week_of=gte.${ws}&order=created_at.desc`),
        sbFetch(`staff_improvement_suggestions?week_of=gte.${ws}&order=week_of.desc`),
      ]);
      setTodayTasks(tasks ?? []);
      setWeekLogs(logs ?? []);
      setBehaviorNotes(notes ?? []);
      setSuggestions(suggs ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today, ws, we]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Derived summary stats
  const totalTasksToday = todayTasks.length;
  const completedToday = todayTasks.filter((t) => t.status === "completed").length;
  const overdueToday = todayTasks.filter((t) => t.status === "overdue").length;
  const activeStaffToday = new Set(
    todayTasks.filter((t) => t.status === "in_progress").map((t) => t.staff_id)
  ).size;
  const completedThisWeek = weekLogs.reduce((s, l) => s + (l.tasks_completed ?? 0), 0);

  // Staff list for modals/filters
  const staffListRaw = Array.from(
    new Map(
      [...todayTasks, ...behaviorNotes].map((t) => [
        t.staff_id,
        { staff_id: t.staff_id, staff_name: t.staff_name },
      ])
    ).values()
  ).sort((a, b) => a.staff_name.localeCompare(b.staff_name));

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "today", label: "Today", icon: <Clock size={14} /> },
    { key: "week", label: "This Week", icon: <BarChart2 size={14} /> },
    { key: "behavior", label: "Behavior Notes", icon: <FileText size={14} /> },
    { key: "suggestions", label: "Improvement Suggestions", icon: <Lightbulb size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Staff Productivity — Superadmin View
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-sm text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-5 py-3 mb-6 text-sm flex items-center gap-2">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {/*
          Planned-Settings notice — a reminder of work designed for the Intake
          dashboard (Employee Time Clock + idle/phone metrics) that needs a
          settings home before being rolled out to the rest of the firm's
          departments. NOTHING IS HARDCODED HERE — this is purely a
          visible memo so we don't lose track. When we wire the real settings
          model, replace this notice with the actual controls.
        */}
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-start gap-3">
            <Lightbulb size={16} className="text-amber-300 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-200 uppercase tracking-widest">
                Planned Settings — Reminder
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mt-1">
                The Intake Portal's <span className="font-semibold text-white">Employee Time Clock</span> + idle/phone metrics
                are currently a front-end scaffold. Before rolling out to the rest of the departments, design and apply
                the matching firm-wide settings here:
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-400 leading-relaxed list-disc pl-5">
                <li>Pay-period start (firm-tz Mon-start vs custom)</li>
                <li>Overtime threshold (default 40h / week, per-firm override)</li>
                <li>Lunch + break policy (when prompted, min/max duration)</li>
                <li>Idle-warning threshold + auto-logout window (currently 14m / 15m on the front end)</li>
                <li>Phone-call time roll-up (depends on the planned <code className="font-mono text-slate-300">calls</code> table)</li>
                <li>Per-employee FMLA eligibility (selected during employee setup — feeds the My Schedule balances)</li>
                <li>Per-department roll-out toggle so the time clock can ship to Legal / Accounting / etc. independently</li>
                <li>Super-admin reporting view for idle / on-phone / total worked / overtime per staffer</li>
              </ul>
              <p className="text-[11px] text-slate-500 italic mt-3 leading-snug">
                No values are configured here yet — intentionally. Design first, then wire to a settings model and a
                <code className="font-mono text-slate-400"> staff_time_entries</code>-style backend before treating any number on the Intake dashboard as real.
              </p>
            </div>
          </div>
        </div>
        {/* /Planned-Settings notice */}

        {/* Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatCard
            icon={<FileText size={18} className="text-slate-400" />}
            label="Tasks Today"
            value={totalTasksToday}
            accent="bg-slate-700/40"
          />
          <StatCard
            icon={<CheckCircle size={18} className="text-emerald-400" />}
            label="Completed Today"
            value={completedToday}
            sub={totalTasksToday > 0 ? `${Math.round((completedToday / totalTasksToday) * 100)}% rate` : undefined}
            accent="bg-emerald-900/30"
          />
          <StatCard
            icon={<AlertTriangle size={18} className="text-red-400" />}
            label="Overdue Today"
            value={overdueToday}
            accent="bg-red-900/30"
          />
          <StatCard
            icon={<Users size={18} className="text-sky-400" />}
            label="Active Staff"
            value={activeStaffToday}
            sub="with in-progress tasks"
            accent="bg-sky-900/30"
          />
          <StatCard
            icon={<BarChart2 size={18} className="text-indigo-400" />}
            label="Completed This Week"
            value={completedThisWeek}
            accent="bg-indigo-900/30"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <RefreshCw size={24} className="animate-spin" />
              <span className="text-sm">Loading staff data...</span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "today" && (
              <TodayTab tasks={todayTasks} onRefresh={() => fetchAll(true)} />
            )}
            {activeTab === "week" && <WeekTab logs={weekLogs} />}
            {activeTab === "behavior" && (
              <BehaviorTab
                notes={behaviorNotes}
                staffList={staffListRaw}
                onRefresh={() => fetchAll(true)}
              />
            )}
            {activeTab === "suggestions" && (
              <SuggestionsTab
                suggestions={suggestions}
                behaviorNotes={behaviorNotes}
                staffList={staffListRaw}
                onRefresh={() => fetchAll(true)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
