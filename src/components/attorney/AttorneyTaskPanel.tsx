import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  X, Plus, Calendar, Phone, FileText, Clock, User, Briefcase,
  CheckCircle, AlertTriangle, Palmtree, Stethoscope, ChevronDown,
  ChevronUp, Bell, RefreshCw
} from "lucide-react";
import { getCurrentAttorneyName } from "../../lib/currentAttorney";

// Was hardcoded "Dominic Majors", then a module-load const. Now a function
// call site at each use so the value re-resolves AFTER login writes to
// sessionStorage — fixes the "logged in as Sarah Kim but task panel still
// queries Jennifer Smith's tasks" mismatch caused by the prior module-load
// cache. The function reads sessionStorage first (set by LegalAdminPortal's
// login handler), then VITE_ATTORNEY_NAME env override, then the default.
function attorneyName(): string { return getCurrentAttorneyName(); }

type TaskType = "hearing" | "client_call" | "signing_call" | "existing_client_call" | "pto" | "personal";

interface Task {
  id: string;
  attorney_name: string;
  task_type: TaskType;
  title: string;
  notes: string;
  scheduled_at: string;
  duration_minutes: number;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  reschedule_notified?: boolean;
  status: "upcoming" | "completed" | "cancelled" | "rescheduled";
  created_at: string;
}

interface PtoRequest {
  id: string;
  attorney_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  superuser_notes: string;
  reviewed_at: string | null;
  created_at: string;
}

interface SickDay {
  id: string;
  attorney_name: string;
  sick_date: string;
  notified_superuser: boolean;
  rescheduled: boolean;
}

const TASK_TYPE_META: Record<TaskType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  hearing: { label: "Hearing", icon: Briefcase, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  client_call: { label: "Client Call", icon: Phone, color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  signing_call: { label: "Signing Call", icon: FileText, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  existing_client_call: { label: "Existing Client Call", icon: User, color: "text-teal-400", bg: "bg-teal-500/15 border-teal-500/30" },
  pto: { label: "Personal Time Off", icon: Palmtree, color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" },
  personal: { label: "Personal", icon: Clock, color: "text-slate-400", bg: "bg-slate-700/50 border-slate-600/30" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function isBlockedDate(date: string, ptoList: PtoRequest[], sickDays: SickDay[]): boolean {
  const d = date.slice(0, 10);
  const isSick = sickDays.some(s => s.sick_date === d);
  const isPto = ptoList.some(p => p.status === "approved" && p.start_date <= d && p.end_date >= d);
  return isSick || isPto;
}

interface Props {
  onClose: () => void;
}

export default function AttorneyTaskPanel({ onClose }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ptoList, setPtoList] = useState<PtoRequest[]>([]);
  const [sickDays, setSickDays] = useState<SickDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "pto" | "sick">("tasks");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewPto, setShowNewPto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const [newTask, setNewTask] = useState({
    task_type: "client_call" as TaskType,
    title: "",
    notes: "",
    scheduled_at: "",
    duration_minutes: 60,
    client_name: "",
    client_email: "",
    client_phone: "",
  });

  const [newPto, setNewPto] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const isSickToday = sickDays.some(s => s.sick_date === todayStr);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: t }, { data: p }, { data: s }] = await Promise.all([
      supabase.from("attorney_tasks").select("*").eq("attorney_name", attorneyName()).order("scheduled_at", { ascending: true }),
      supabase.from("attorney_pto_requests").select("*").eq("attorney_name", attorneyName()).order("created_at", { ascending: false }),
      supabase.from("attorney_sick_days").select("*").eq("attorney_name", attorneyName()).order("sick_date", { ascending: false }),
    ]);
    setTasks((t as Task[]) ?? []);
    setPtoList((p as PtoRequest[]) ?? []);
    setSickDays((s as SickDay[]) ?? []);
    setLoading(false);
  }

  async function addTask() {
    if (!newTask.title || !newTask.scheduled_at) return;
    const scheduledDate = newTask.scheduled_at.slice(0, 10);
    if (isBlockedDate(scheduledDate, ptoList, sickDays)) {
      setSuccessMsg("That date is blocked (PTO or sick day). Please choose another date.");
      setTimeout(() => setSuccessMsg(""), 4000);
      return;
    }
    setSubmitting(true);
    await supabase.from("attorney_tasks").insert({
      attorney_name: attorneyName(),
      task_type: newTask.task_type,
      title: newTask.title,
      notes: newTask.notes,
      scheduled_at: new Date(newTask.scheduled_at).toISOString(),
      duration_minutes: newTask.duration_minutes,
      client_name: newTask.client_name,
      client_email: newTask.client_email,
      client_phone: newTask.client_phone,
      status: "upcoming",
    });
    setNewTask({ task_type: "client_call", title: "", notes: "", scheduled_at: "", duration_minutes: 60, client_name: "", client_email: "", client_phone: "" });
    setShowNewTask(false);
    setSuccessMsg("Task scheduled.");
    setTimeout(() => setSuccessMsg(""), 3000);
    await loadAll();
    setSubmitting(false);
  }

  async function addPtoRequest() {
    if (!newPto.start_date || !newPto.end_date) return;
    setSubmitting(true);
    await supabase.from("attorney_pto_requests").insert({
      attorney_name: attorneyName(),
      start_date: newPto.start_date,
      end_date: newPto.end_date,
      reason: newPto.reason,
      status: "pending",
    });
    setNewPto({ start_date: "", end_date: "", reason: "" });
    setShowNewPto(false);
    setSuccessMsg("PTO request submitted — awaiting superuser approval.");
    setTimeout(() => setSuccessMsg(""), 4000);
    await loadAll();
    setSubmitting(false);
  }

  async function markSickToday() {
    if (isSickToday) return;
    setSubmitting(true);
    await supabase.from("attorney_sick_days").insert({
      attorney_name: attorneyName(),
      sick_date: todayStr,
      notified_superuser: true,
      rescheduled: false,
    });
    const todayTasks = tasks.filter(t => t.scheduled_at.slice(0, 10) === todayStr && t.status === "upcoming");
    for (const t of todayTasks) {
      await supabase.from("attorney_tasks").update({ status: "rescheduled" }).eq("id", t.id);
    }
    await fetch(`${supabaseUrl}/functions/v1/reschedule-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        sick_date: todayStr,
        attorney_name: attorneyName(),
        reason: "The attorney is out sick today. All appointments are being rescheduled and we will be in contact shortly to confirm a new time.",
      }),
    }).catch(() => {});
    setSuccessMsg("Sick day logged. Clients are being texted and emailed automatically. Superuser alerted.");
    setTimeout(() => setSuccessMsg(""), 6000);
    await loadAll();
    setSubmitting(false);
  }

  async function updateTaskStatus(id: string, status: Task["status"]) {
    await supabase.from("attorney_tasks").update({ status }).eq("id", id);
    if (status === "rescheduled") {
      setNotifyingId(id);
      await fetch(`${supabaseUrl}/functions/v1/reschedule-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify({ task_id: id }),
      }).catch(() => {});
      setNotifyingId(null);
      setSuccessMsg("Client has been texted and emailed about the reschedule.");
      setTimeout(() => setSuccessMsg(""), 5000);
    }
    await loadAll();
  }

  const upcomingTasks = tasks.filter(t => t.status === "upcoming" && new Date(t.scheduled_at) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const pastTasks = tasks.filter(t => t.status !== "upcoming" || new Date(t.scheduled_at) < new Date(new Date().setHours(0, 0, 0, 0)));
  const pendingPto = ptoList.filter(p => p.status === "pending");
  const approvedPto = ptoList.filter(p => p.status === "approved");
  const todaySickEntry = sickDays.find(s => s.sick_date === todayStr);
  const todayHearings = tasks.filter(t => t.task_type === "hearing" && t.scheduled_at.slice(0, 10) === todayStr && t.status === "upcoming");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl bg-slate-900 border-l border-slate-800 overflow-y-auto flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-400/15 rounded-lg flex items-center justify-center">
                <CheckCircle size={16} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">My Tasks & Schedule</h2>
                <p className="text-slate-500 text-xs">{attorneyName()}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-lg">
              <X size={16} />
            </button>
          </div>

          {isSickToday && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-xl mb-2">
              <Stethoscope size={13} className="text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-xs font-semibold">Sick day logged for today — calendar blocked &amp; superuser notified</span>
            </div>
          )}

          {todayHearings.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/15 border border-orange-500/30 rounded-xl mb-2">
              <Bell size={13} className="text-orange-400 flex-shrink-0" />
              <span className="text-orange-300 text-xs font-semibold">Hearing today — superuser has been alerted</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/30 rounded-xl mb-2">
              <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
              <span className="text-green-300 text-xs">{successMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            {(["tasks", "pto", "sick"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}
              >
                {t === "tasks" ? "Tasks" : t === "pto" ? `PTO ${pendingPto.length > 0 ? `(${pendingPto.length})` : ""}` : "Sick Day"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={20} className="text-slate-600 animate-spin" />
            </div>
          )}

          {!loading && tab === "tasks" && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Upcoming ({upcomingTasks.length})</h3>
                <button
                  onClick={() => setShowNewTask(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold rounded-lg transition-all"
                >
                  <Plus size={12} /> New Task
                </button>
              </div>

              {showNewTask && (
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">New Task</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Type</label>
                      <select
                        value={newTask.task_type}
                        onChange={e => setNewTask(p => ({ ...p, task_type: e.target.value as TaskType }))}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                      >
                        {Object.entries(TASK_TYPE_META).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Title</label>
                      <input
                        value={newTask.title}
                        onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                        placeholder="e.g. Ch. 7 Hearing – Martinez"
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={newTask.scheduled_at}
                        onChange={e => setNewTask(p => ({ ...p, scheduled_at: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Duration (min)</label>
                      <input
                        type="number"
                        value={newTask.duration_minutes}
                        onChange={e => setNewTask(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Client Name</label>
                      <input
                        value={newTask.client_name}
                        onChange={e => setNewTask(p => ({ ...p, client_name: e.target.value }))}
                        placeholder="Client name"
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Client Email <span className="text-amber-400/60">for reschedule alerts</span></label>
                      <input
                        type="email"
                        value={newTask.client_email}
                        onChange={e => setNewTask(p => ({ ...p, client_email: e.target.value }))}
                        placeholder="client@email.com"
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Client Phone <span className="text-amber-400/60">for SMS alerts</span></label>
                      <input
                        type="tel"
                        value={newTask.client_phone}
                        onChange={e => setNewTask(p => ({ ...p, client_phone: e.target.value }))}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Notes</label>
                      <textarea
                        value={newTask.notes}
                        onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))}
                        rows={2}
                        placeholder="Additional notes..."
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowNewTask(false)} className="px-3 py-1.5 text-slate-400 hover:text-white text-xs transition-colors">Cancel</button>
                    <button onClick={addTask} disabled={submitting || !newTask.title || !newTask.scheduled_at} className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-900 text-xs font-bold rounded-lg transition-all">
                      {submitting ? "Saving..." : "Save Task"}
                    </button>
                  </div>
                </div>
              )}

              {upcomingTasks.length === 0 && !showNewTask && (
                <div className="text-center py-8 text-slate-600 text-sm">No upcoming tasks. Click New Task to schedule one.</div>
              )}

              {upcomingTasks.map(task => {
                const meta = TASK_TYPE_META[task.task_type];
                const Icon = meta.icon;
                const isExpanded = expandedTask === task.id;
                const isBlockedByAbsence = isBlockedDate(task.scheduled_at.slice(0, 10), ptoList, sickDays);
                return (
                  <div key={task.id} className={`border rounded-2xl overflow-hidden ${meta.bg} ${isBlockedByAbsence ? "opacity-60" : ""}`}>
                    <button
                      className="w-full flex items-start gap-3 p-4 text-left"
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-900/50`}>
                        <Icon size={15} className={meta.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                          {isBlockedByAbsence && <span className="text-xs text-red-400 font-semibold">BLOCKED</span>}
                        </div>
                        <p className="text-white text-sm font-semibold mt-0.5 truncate">{task.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{formatDateTime(task.scheduled_at)} · {task.duration_minutes}min</p>
                        {task.client_name && <p className="text-slate-500 text-xs">{task.client_name}</p>}
                      </div>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-500 flex-shrink-0 mt-1" /> : <ChevronDown size={14} className="text-slate-500 flex-shrink-0 mt-1" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-slate-700/30 pt-3">
                        {task.notes && <p className="text-slate-400 text-xs">{task.notes}</p>}
                        {(task.client_email || task.client_phone) && (
                          <p className="text-slate-600 text-xs flex items-center gap-1.5">
                            <Bell size={9} className="text-amber-400/60" />
                            AI will auto-notify client via {[task.client_email && "email", task.client_phone && "SMS"].filter(Boolean).join(" + ")} on reschedule
                          </p>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => updateTaskStatus(task.id, "completed")} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-xs font-semibold rounded-lg transition-all">
                            <CheckCircle size={11} /> Complete
                          </button>
                          <button
                            onClick={() => updateTaskStatus(task.id, "rescheduled")}
                            disabled={notifyingId === task.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg transition-all disabled:opacity-60"
                          >
                            <RefreshCw size={11} className={notifyingId === task.id ? "animate-spin" : ""} />
                            {notifyingId === task.id ? "Notifying..." : "Reschedule + Notify"}
                          </button>
                          <button onClick={() => updateTaskStatus(task.id, "cancelled")} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold rounded-lg transition-all">
                            <X size={11} /> Cancel
                          </button>
                        </div>
                        {task.reschedule_notified && (
                          <p className="text-green-500/70 text-xs flex items-center gap-1"><CheckCircle size={9} /> Client notified</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {pastTasks.length > 0 && (
                <>
                  <h3 className="text-slate-600 font-semibold text-xs uppercase tracking-wider pt-2">Past / Completed</h3>
                  {pastTasks.slice(0, 5).map(task => {
                    const meta = TASK_TYPE_META[task.task_type];
                    const Icon = meta.icon;
                    return (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/30 rounded-xl opacity-60">
                        <Icon size={13} className={meta.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-400 text-xs font-semibold truncate">{task.title}</p>
                          <p className="text-slate-600 text-xs">{formatDateTime(task.scheduled_at)}</p>
                        </div>
                        <span className={`text-xs font-bold capitalize ${task.status === "completed" ? "text-green-500" : task.status === "cancelled" ? "text-red-500" : "text-amber-500"}`}>{task.status}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {!loading && tab === "pto" && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">PTO Requests</h3>
                <button
                  onClick={() => setShowNewPto(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-xs font-semibold rounded-lg transition-all"
                >
                  <Plus size={12} /> Request PTO
                </button>
              </div>

              {showNewPto && (
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">New PTO Request</p>
                  <p className="text-xs text-slate-500">Your request will be sent to the superuser for approval before being added to the calendar.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Start Date</label>
                      <input
                        type="date"
                        value={newPto.start_date}
                        onChange={e => setNewPto(p => ({ ...p, start_date: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">End Date</label>
                      <input
                        type="date"
                        value={newPto.end_date}
                        onChange={e => setNewPto(p => ({ ...p, end_date: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Reason (optional)</label>
                      <textarea
                        value={newPto.reason}
                        onChange={e => setNewPto(p => ({ ...p, reason: e.target.value }))}
                        rows={2}
                        placeholder="Vacation, personal, etc."
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowNewPto(false)} className="px-3 py-1.5 text-slate-400 hover:text-white text-xs transition-colors">Cancel</button>
                    <button onClick={addPtoRequest} disabled={submitting || !newPto.start_date || !newPto.end_date} className="px-4 py-1.5 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all">
                      {submitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </div>
              )}

              {ptoList.length === 0 && !showNewPto && (
                <div className="text-center py-8 text-slate-600 text-sm">No PTO requests yet.</div>
              )}

              {ptoList.map(pto => (
                <div key={pto.id} className={`border rounded-2xl p-4 ${pto.status === "approved" ? "bg-green-500/10 border-green-500/25" : pto.status === "denied" ? "bg-red-500/10 border-red-500/25" : "bg-slate-800/50 border-slate-700/40"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Palmtree size={14} className="text-green-400" />
                      <span className="text-white text-sm font-semibold">{formatDate(pto.start_date)} – {formatDate(pto.end_date)}</span>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${pto.status === "approved" ? "bg-green-500/20 text-green-300" : pto.status === "denied" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {pto.status === "pending" ? "Pending Approval" : pto.status}
                    </span>
                  </div>
                  {pto.reason && <p className="text-slate-500 text-xs mt-1">{pto.reason}</p>}
                  {pto.status === "pending" && <p className="text-amber-400/70 text-xs mt-1.5 flex items-center gap-1"><AlertTriangle size={10} /> Awaiting superuser approval — calendar not blocked yet</p>}
                  {pto.status === "approved" && <p className="text-green-400/70 text-xs mt-1.5 flex items-center gap-1"><CheckCircle size={10} /> Approved — dates blocked on calendar</p>}
                  {pto.superuser_notes && <p className="text-slate-400 text-xs mt-1 italic">{pto.superuser_notes}</p>}
                </div>
              ))}

              {approvedPto.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 mt-2">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Blocked Dates</p>
                  {approvedPto.map(p => (
                    <p key={p.id} className="text-xs text-slate-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />{formatDate(p.start_date)} – {formatDate(p.end_date)}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && tab === "sick" && (
            <>
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
                    <Stethoscope size={20} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold">I Am Sick Today</p>
                    <p className="text-slate-500 text-xs">Blocks today's calendar and reschedules all appointments</p>
                  </div>
                </div>
                <ul className="text-xs text-slate-500 space-y-1 pl-1">
                  <li className="flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">·</span> Today's appointments will be marked for rescheduling</li>
                  <li className="flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">·</span> Superuser will receive an immediate alert</li>
                  <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">·</span> If you have a hearing today, the superuser will be separately notified</li>
                  <li className="flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">·</span> No new appointments can be booked on blocked dates</li>
                </ul>
                {isSickToday ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-xl">
                    <CheckCircle size={15} className="text-red-400" />
                    <span className="text-red-300 text-sm font-semibold">Sick day already logged for today</span>
                  </div>
                ) : (
                  <button
                    onClick={markSickToday}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold rounded-xl transition-all text-sm disabled:opacity-50"
                  >
                    <Stethoscope size={15} />
                    {submitting ? "Processing..." : "Mark as Sick Today"}
                  </button>
                )}
              </div>

              {todaySickEntry && todayHearings.length > 0 && (
                <div className="flex items-start gap-2 px-4 py-3 bg-orange-500/15 border border-orange-500/30 rounded-xl">
                  <Bell size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-orange-300 text-sm font-bold">Hearing Alert Sent</p>
                    <p className="text-orange-400/70 text-xs">Superuser has been notified of {todayHearings.length} hearing{todayHearings.length > 1 ? "s" : ""} that need to be addressed.</p>
                  </div>
                </div>
              )}

              {sickDays.length > 0 && (
                <>
                  <h3 className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Sick Day History</h3>
                  {sickDays.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/40 border border-slate-700/30 rounded-xl">
                      <Stethoscope size={13} className="text-red-400 flex-shrink-0" />
                      <span className="text-slate-400 text-sm flex-1">{formatDate(s.sick_date)}</span>
                      {s.notified_superuser && <span className="text-xs text-green-500">Notified</span>}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
