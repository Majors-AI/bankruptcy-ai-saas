import { useState, useEffect, useCallback, useRef } from "react";
import {
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bell,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Check,
  SkipForward,
  Timer,
  Calendar,
  RefreshCw,
  Briefcase,
  AlertCircle,
  CheckCheck,
  Flame,
  TrendingUp,
  Star,
} from "lucide-react";

// ─── Supabase ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path: string, opts: RequestInit & { headers?: Record<string, string> } = {}) {
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

// ─── Types ─────────────────────────────────────────────────────────────────────

type Priority = "urgent" | "high" | "medium" | "low";
type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
type TaskSource = "template" | "client_request" | "manual" | "system" | "superadmin";

interface StaffTask {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_role: string;
  task_date: string;
  title: string;
  description: string | null;
  priority: Priority;
  source: TaskSource;
  client_id: string | null;
  client_name: string | null;
  status: TaskStatus;
  due_time: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  notes: string | null;
  created_at: string;
}

interface StaffReminder {
  id: string;
  staff_id: string;
  staff_name: string;
  task_id: string | null;
  title: string;
  message: string | null;
  remind_at: string;
  channel: string | null;
  sent: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  staffId: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STAFF_MEMBERS: StaffMember[] = [
  { id: "STAFF-001", name: "Linda Park", role: "Paralegal", staffId: "STAFF-001" },
  { id: "STAFF-002", name: "Carlos Reyes", role: "Legal Admin", staffId: "STAFF-002" },
  { id: "STAFF-003", name: "Sarah Mitchell", role: "Attorney", staffId: "STAFF-003" },
  { id: "STAFF-004", name: "David Chen", role: "Attorney", staffId: "STAFF-004" },
  { id: "STAFF-005", name: "Maria Lopez", role: "Accounting Admin", staffId: "STAFF-005" },
];

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const PRIORITY_STRIP: Record<Priority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const PRIORITY_TEXT: Record<Priority, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-emerald-400",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "URGENT",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

const SOURCE_BADGE: Record<TaskSource, string> = {
  template: "bg-slate-700 text-slate-300",
  client_request: "bg-sky-900/60 text-sky-300",
  system: "bg-teal-900/60 text-teal-300",
  superadmin: "bg-amber-900/60 text-amber-300",
  manual: "bg-slate-800 text-slate-400",
};

const SOURCE_LABEL: Record<TaskSource, string> = {
  template: "Template",
  client_request: "Client",
  system: "System",
  superadmin: "Admin",
  manual: "Manual",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function dueCountdown(dueTime: string | null, taskDate: string): { label: string; overdue: boolean } | null {
  if (!dueTime) return null;
  const now = new Date();
  const [hh, mm] = dueTime.split(":").map(Number);
  const due = new Date(taskDate);
  due.setHours(hh, mm, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 0) {
    const abs = Math.abs(diffMin);
    if (abs >= 60) {
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return { label: `OVERDUE ${h}h ${m}m`, overdue: true };
    }
    return { label: `OVERDUE ${abs}m`, overdue: true };
  }
  if (diffMin >= 60) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return { label: `Due in ${h}h ${m}m`, overdue: false };
  }
  return { label: `Due in ${diffMin}m`, overdue: false };
}

function isOverdue(task: StaffTask): boolean {
  if (task.status === "completed" || task.status === "skipped") return false;
  if (!task.due_time) return false;
  const cd = dueCountdown(task.due_time, task.task_date);
  return cd?.overdue ?? false;
}

function sortTasks(tasks: StaffTask[]): StaffTask[] {
  return [...tasks].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return 0;
  });
}

// ─── Add Task Modal ────────────────────────────────────────────────────────────

interface AddTaskModalProps {
  staffMember: StaffMember;
  onClose: () => void;
  onAdded: () => void;
}

function AddTaskModal({ staffMember, onClose, onAdded }: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueTime, setDueTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await sbFetch("staff_daily_tasks", {
        method: "POST",
        body: JSON.stringify({
          staff_id: staffMember.staffId,
          staff_name: staffMember.name,
          staff_role: staffMember.role,
          task_date: todayStr(),
          title: title.trim(),
          description: description.trim() || null,
          priority,
          source: "manual",
          client_name: clientName.trim() || null,
          status: "pending",
          due_time: dueTime || null,
          estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        }),
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1220] border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-400" />
            Add Manual Task
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title *</label>
            <input
              className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea
              className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors resize-none"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Priority</label>
              <select
                className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Due Time</label>
              <input
                type="time"
                className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client Name</label>
              <input
                className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Optional..."
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Est. Minutes</label>
              <input
                type="number"
                min="1"
                className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              {saving ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Reminder Modal ────────────────────────────────────────────────────────

interface AddReminderModalProps {
  staffMember: StaffMember;
  tasks: StaffTask[];
  onClose: () => void;
  onAdded: () => void;
}

function AddReminderModal({ staffMember, tasks, onClose, onAdded }: AddReminderModalProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [taskId, setTaskId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !remindAt) { setError("Title and remind time are required."); return; }
    setSaving(true);
    setError(null);
    try {
      const remindAtFull = `${todayStr()}T${remindAt}:00`;
      await sbFetch("staff_reminders", {
        method: "POST",
        body: JSON.stringify({
          staff_id: staffMember.staffId,
          staff_name: staffMember.name,
          task_id: taskId || null,
          title: title.trim(),
          message: message.trim() || null,
          remind_at: remindAtFull,
          channel: "dashboard",
          sent: false,
        }),
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add reminder.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b1220] border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Add Reminder
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title *</label>
            <input
              className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title..."
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Message</label>
            <textarea
              className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Remind At *</label>
              <input
                type="time"
                className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Link to Task</label>
              <select
                className="w-full bg-[#050a14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">None</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title.slice(0, 30)}{t.title.length > 30 ? "…" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : "Add Reminder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Log Time Mini Form ────────────────────────────────────────────────────────

interface LogTimeFormProps {
  task: StaffTask;
  onLogged: () => void;
}

function LogTimeForm({ task, onLogged }: LogTimeFormProps) {
  const [minutes, setMinutes] = useState(task.actual_minutes?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleLog() {
    if (!minutes || isNaN(parseInt(minutes, 10))) return;
    setSaving(true);
    try {
      await sbFetch(`staff_daily_tasks?id=eq.${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ actual_minutes: parseInt(minutes, 10) }),
      });
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Timer className="w-3.5 h-3.5 text-slate-500" />
      <input
        type="number"
        min="1"
        className="w-20 bg-[#050a14] border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-sky-500"
        placeholder="mins"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <button
        onClick={handleLog}
        disabled={saving || !minutes}
        className="text-xs bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
      >
        {saving ? "Logging..." : "Log"}
      </button>
      {task.actual_minutes && (
        <span className="text-xs text-slate-500">{task.actual_minutes}m logged</span>
      )}
    </div>
  );
}

// ─── Task Card ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: StaffTask;
  onStatusChange: (id: string, status: TaskStatus) => Promise<void>;
  onRefresh: () => void;
}

function TaskCard({ task, onStatusChange, onRefresh }: TaskCardProps) {
  const [updating, setUpdating] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const overdue = isOverdue(task);
  const countdown = dueCountdown(task.due_time, task.task_date);

  async function changeStatus(newStatus: TaskStatus) {
    setUpdating(true);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setUpdating(false);
    }
  }

  const isCompleted = task.status === "completed";
  const isSkipped = task.status === "skipped";
  const isInProgress = task.status === "in_progress";
  const isDone = isCompleted || isSkipped;

  return (
    <div
      className={`relative bg-[#0b1220] rounded-2xl border overflow-hidden transition-all duration-300 ${
        overdue
          ? "border-red-500/40"
          : isCompleted
          ? "border-emerald-500/20 opacity-70"
          : isSkipped
          ? "border-slate-700/40 opacity-50"
          : "border-slate-800 hover:border-slate-700"
      }`}
    >
      {/* Priority strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${PRIORITY_STRIP[task.priority]}`} />

      <div className="pl-4 pr-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-sm font-semibold leading-snug ${
                  isCompleted ? "line-through text-slate-500" : isSkipped ? "line-through text-slate-600" : "text-white"
                }`}
              >
                {task.title}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${SOURCE_BADGE[task.source]}`}
              >
                {SOURCE_LABEL[task.source]}
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{task.description}</p>
            )}

            {/* Client + meta row */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {task.client_name && (
                <span className="flex items-center gap-1 text-xs text-sky-400">
                  <Briefcase className="w-3 h-3" />
                  {task.client_name}
                </span>
              )}
              {task.estimated_minutes && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {task.estimated_minutes}m est.
                </span>
              )}
              <span className={`text-xs font-semibold ${PRIORITY_TEXT[task.priority]}`}>
                {PRIORITY_LABEL[task.priority]}
              </span>
            </div>

            {/* Countdown */}
            {countdown && !isDone && (
              <div
                className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${
                  countdown.overdue ? "text-red-400" : "text-slate-400"
                }`}
              >
                {countdown.overdue ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                {countdown.overdue ? countdown.label : `${formatTime(task.due_time)} · ${countdown.label}`}
              </div>
            )}
            {task.due_time && isDone && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-600">
                <Clock className="w-3 h-3" />
                {formatTime(task.due_time)}
              </div>
            )}

            {/* Log time form */}
            {isInProgress && showLogTime && (
              <LogTimeForm task={task} onLogged={() => { setShowLogTime(false); onRefresh(); }} />
            )}
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0 mt-0.5">
            {isCompleted && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3" />
                Done
              </span>
            )}
            {isSkipped && (
              <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                <SkipForward className="w-3 h-3" />
                Skipped
              </span>
            )}
            {isInProgress && (
              <span className="flex items-center gap-1 text-xs text-sky-400 bg-sky-900/30 border border-sky-500/20 rounded-full px-2 py-0.5">
                <Play className="w-3 h-3" />
                In Progress
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!isDone && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {task.status === "pending" && (
              <button
                onClick={() => changeStatus("in_progress")}
                disabled={updating}
                className="flex items-center gap-1.5 text-xs bg-sky-700/40 hover:bg-sky-700/70 border border-sky-600/40 text-sky-300 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                Start
              </button>
            )}
            {(task.status === "pending" || task.status === "in_progress") && (
              <button
                onClick={() => changeStatus("completed")}
                disabled={updating}
                className="flex items-center gap-1.5 text-xs bg-emerald-700/40 hover:bg-emerald-700/70 border border-emerald-600/40 text-emerald-300 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                Complete
              </button>
            )}
            {task.status === "in_progress" && (
              <button
                onClick={() => setShowLogTime((v) => !v)}
                className="flex items-center gap-1.5 text-xs bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/40 text-slate-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Timer className="w-3 h-3" />
                Log Time
              </button>
            )}
            {task.status === "pending" && (
              <button
                onClick={() => changeStatus("skipped")}
                disabled={updating}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-500 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <SkipForward className="w-3 h-3" />
                Skip
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reminders Panel ───────────────────────────────────────────────────────────

interface RemindersPanelProps {
  staffMember: StaffMember;
  reminders: StaffReminder[];
  tasks: StaffTask[];
  loading: boolean;
  onRefresh: () => void;
}

function RemindersPanel({ staffMember, reminders, tasks, loading, onRefresh }: RemindersPanelProps) {
  const [open, setOpen] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function markSent(id: string) {
    setMarkingId(id);
    try {
      await sbFetch(`staff_reminders?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ sent: true }),
      });
      onRefresh();
    } finally {
      setMarkingId(null);
    }
  }

  const unread = reminders.filter((r) => !r.sent).length;

  return (
    <>
      {showAddModal && (
        <AddReminderModal
          staffMember={staffMember}
          tasks={tasks}
          onClose={() => setShowAddModal(false)}
          onAdded={onRefresh}
        />
      )}
      <div className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-white font-semibold text-sm">Reminders</span>
            {unread > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-2 py-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
            {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </button>

        {open && (
          <div className="px-5 pb-4 border-t border-slate-800">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Loading reminders...
              </div>
            ) : reminders.length === 0 ? (
              <div className="py-6 text-center text-slate-600 text-sm">
                No reminders for today.
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {reminders.map((r) => {
                  const reminderTime = new Date(r.remind_at);
                  const timeStr = reminderTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  const isPast = reminderTime < new Date();
                  return (
                    <div
                      key={r.id}
                      className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                        r.sent
                          ? "bg-slate-900/30 border-slate-800/50 opacity-50"
                          : isPast
                          ? "bg-amber-900/10 border-amber-500/20"
                          : "bg-slate-900/40 border-slate-800"
                      }`}
                    >
                      <Bell
                        className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                          r.sent ? "text-slate-600" : isPast ? "text-amber-400" : "text-amber-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <span className={`text-xs font-medium ${r.sent ? "text-slate-600 line-through" : "text-white"}`}>
                            {r.title}
                          </span>
                          <span className="text-[10px] text-slate-500 flex-shrink-0">{timeStr}</span>
                        </div>
                        {r.message && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{r.message}</p>
                        )}
                      </div>
                      {!r.sent && (
                        <button
                          onClick={() => markSent(r.id)}
                          disabled={markingId === r.id}
                          className="flex-shrink-0 text-[10px] bg-emerald-800/40 hover:bg-emerald-700/50 border border-emerald-600/30 text-emerald-400 rounded px-1.5 py-0.5 transition-colors disabled:opacity-50"
                        >
                          {markingId === r.id ? "..." : "✓"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon, color, sub }: StatCardProps) {
  return (
    <div className="bg-[#0b1220] border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember>(STAFF_MEMBERS[0]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [reminders, setReminders] = useState<StaffReminder[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [now, setNow] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tick every minute to update countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    setError(null);
    try {
      const today = todayStr();
      const data = await sbFetch(
        `staff_daily_tasks?staff_id=eq.${selectedStaff.staffId}&task_date=eq.${today}&order=created_at.asc`
      );
      setTasks(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [selectedStaff]);

  const fetchReminders = useCallback(async () => {
    setLoadingReminders(true);
    try {
      const today = todayStr();
      const data = await sbFetch(
        `staff_reminders?staff_id=eq.${selectedStaff.staffId}&remind_at=gte.${today}T00:00:00&remind_at=lte.${today}T23:59:59&order=remind_at.asc`
      );
      setReminders(Array.isArray(data) ? data : []);
    } catch {
      setReminders([]);
    } finally {
      setLoadingReminders(false);
    }
  }, [selectedStaff]);

  useEffect(() => {
    fetchTasks();
    fetchReminders();
  }, [fetchTasks, fetchReminders]);

  async function handleStatusChange(id: string, status: TaskStatus) {
    const patch: Partial<StaffTask> = { status };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    await sbFetch(`staff_daily_tasks?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    await fetchTasks();
  }

  // Computed stats
  const today = todayStr();
  const todayTasks = tasks.filter((t) => t.task_date === today);
  const totalCount = todayTasks.length;
  const completedCount = todayTasks.filter((t) => t.status === "completed").length;
  const activeCount = todayTasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const overdueCount = todayTasks.filter((t) => isOverdue(t)).length;
  const unreadReminders = reminders.filter((r) => !r.sent).length;

  const sortedTasks = sortTasks(todayTasks);

  const greeting = getGreeting();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Role color
  const roleColors: Record<string, string> = {
    Paralegal: "text-slate-300 bg-slate-700/40 border-slate-600/40",
    "Legal Admin": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Attorney: "text-sky-300 bg-sky-400/10 border-sky-400/20",
    "Accounting Admin": "text-teal-400 bg-teal-500/10 border-teal-500/20",
  };
  const roleBadgeClass = roleColors[selectedStaff.role] ?? "text-slate-400 bg-slate-800 border-slate-700";

  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      {/* Modals */}
      {showAddTask && (
        <AddTaskModal
          staffMember={selectedStaff}
          onClose={() => setShowAddTask(false)}
          onAdded={fetchTasks}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                {greeting}, {selectedStaff.name.split(" ")[0]}!
              </h1>
              <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${roleBadgeClass}`}>
                {selectedStaff.role}
              </span>
              {unreadReminders > 0 && (
                <span className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs rounded-full px-2 py-0.5">
                  <Bell className="w-3 h-3" />
                  {unreadReminders} reminder{unreadReminders > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              {dateLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Staff Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowStaffDropdown((v) => !v)}
                className="flex items-center gap-2 bg-[#0b1220] border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-2 text-sm text-white transition-colors"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span className="max-w-[120px] truncate">{selectedStaff.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showStaffDropdown ? "rotate-180" : ""}`} />
              </button>
              {showStaffDropdown && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-[#0b1220] border border-slate-700 rounded-xl shadow-2xl w-52 overflow-hidden">
                  {STAFF_MEMBERS.map((s) => (
                    <button
                      key={s.staffId}
                      onClick={() => { setSelectedStaff(s); setShowStaffDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.04] transition-colors ${
                        s.staffId === selectedStaff.staffId ? "text-sky-400 bg-sky-500/5" : "text-slate-300"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
                        {s.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="text-left">
                        <div className="font-medium leading-none">{s.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{s.role}</div>
                      </div>
                      {s.staffId === selectedStaff.staffId && (
                        <Check className="w-3.5 h-3.5 ml-auto text-sky-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => { fetchTasks(); fetchReminders(); }}
              className="p-2 bg-[#0b1220] border border-slate-700 hover:border-slate-600 rounded-xl text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTasks ? "animate-spin" : ""}`} />
            </button>

            {/* Add Task */}
            <button
              onClick={() => setShowAddTask(true)}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </div>

        {/* ── Error Banner ─────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Overview Stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Tasks Today"
            value={totalCount}
            icon={<Briefcase className="w-5 h-5 text-sky-400" />}
            color="bg-sky-500/10"
          />
          <StatCard
            label="Completed"
            value={completedCount}
            icon={<CheckCheck className="w-5 h-5 text-emerald-400" />}
            color="bg-emerald-500/10"
          />
          <StatCard
            label="Pending / Active"
            value={activeCount}
            icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
            color="bg-amber-500/10"
          />
          <StatCard
            label="Overdue"
            value={overdueCount}
            icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
            color="bg-red-500/10"
            sub={overdueCount > 0 ? "Needs attention" : "All on track"}
          />
        </div>

        {/* ── Task List ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              Today's Tasks
              {totalCount > 0 && (
                <span className="text-xs text-slate-500 font-normal">({totalCount})</span>
              )}
            </h2>
          </div>

          {loadingTasks ? (
            <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-8 flex items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading tasks...
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-10 text-center">
              <Star className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No tasks for today.</p>
              <p className="text-slate-600 text-xs mt-1">Click "Add Task" to create one manually.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onRefresh={fetchTasks}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Reminders Panel ──────────────────────────────────────────────── */}
        <RemindersPanel
          staffMember={selectedStaff}
          reminders={reminders}
          tasks={tasks}
          loading={loadingReminders}
          onRefresh={fetchReminders}
        />

        {/* ── Daily Summary ─────────────────────────────────────────────────── */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Daily Summary</h3>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            {totalCount === 0 ? (
              <>No tasks scheduled for today yet. Add some tasks to track your progress.</>
            ) : completedCount === totalCount ? (
              <>
                <span className="text-emerald-400 font-semibold">Outstanding work!</span> You've completed all{" "}
                <span className="text-white font-medium">{totalCount}</span> task{totalCount !== 1 ? "s" : ""} for today. Enjoy the rest of your day!
              </>
            ) : (
              <>
                You have completed{" "}
                <span className="text-emerald-400 font-semibold">{completedCount}</span> of{" "}
                <span className="text-white font-medium">{totalCount}</span> task{totalCount !== 1 ? "s" : ""} today.{" "}
                {activeCount > 0 && (
                  <>
                    <span className="text-amber-400 font-semibold">{activeCount}</span> task{activeCount !== 1 ? "s are" : " is"} still pending or in progress.{" "}
                  </>
                )}
                {overdueCount > 0 ? (
                  <>
                    <span className="text-red-400 font-semibold">{overdueCount}</span> task{overdueCount !== 1 ? "s are" : " is"} overdue — prioritize those first.
                  </>
                ) : (
                  <>Keep up the great work, {selectedStaff.name.split(" ")[0]}!</>
                )}
              </>
            )}
          </p>
          {totalCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
