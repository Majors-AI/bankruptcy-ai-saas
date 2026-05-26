import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, MapPin, Calendar, CheckCircle2, AlertTriangle, Coffee, Briefcase, Scale, FileText, Users, Bell, Filter, RefreshCw, ChevronDown, Info, Lock, Send, Thermometer, Building2, CreditCard as Edit2, Trash2, Check, XCircle, Shield, ArrowRight, Settings, CalendarDays, ListChecks, LayoutGrid, Layers } from "lucide-react";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const api = {
  get: async (path: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    return r.ok ? r.json() : [];
  },
  post: async (table: string, body: object) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.ok ? r.json() : null;
  },
  patch: async (table: string, id: string, body: object) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.ok ? r.json() : null;
  },
  upsert: async (table: string, body: object, onConflict: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    });
    return r.ok ? r.json() : null;
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarType = "intake" | "doc_review" | "signing" | "court_hearing" | "court_deadline";
type EventStatus  = "scheduled" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "no_show";
type StaffRole    = "admin" | "attorney" | "paralegal" | "intake_staff" | "accounting";
type PtoStatus    = "pending" | "approved" | "denied";
type ViewMode     = "day" | "week" | "two_weeks" | "month" | "year";
type ActiveCal    = "all" | CalendarType;
type Department   = "all" | "intake" | "paralegal" | "attorney";

interface AppointmentReminder {
  id: string;
  event_id: string;
  minutes_before: 5 | 15 | 30;
  shown_at: string;
  dismissed: boolean;
}

interface StaffMember {
  id: string; name: string; email: string; role: StaffRole; color: string;
  is_active: boolean; max_intake_per_hour: number; max_doc_review_per_hour: number;
}

interface AttorneyAvailability {
  id?: string;
  staff_id: string;
  chapters_handled: string[];
  signing_days: number[];
  max_signings_per_day: number;
  hearing_buffer_before_minutes: number;
  hearing_buffer_after_minutes: number;
}

interface PtoRequest {
  id: string; staff_id: string; start_date: string; end_date: string;
  reason: string; status: PtoStatus; approved_by?: string; denial_reason?: string;
  created_at: string;
}

interface SickReport {
  id: string; staff_id: string; report_date: string; coverage_status: string;
  affected_appt_count: number; rescheduled_count: number; notes?: string;
  sick_override_id?: string; flagged_event_ids?: string[]; resolution?: string;
}

interface SickOverride {
  id: string; staff_id: string; staff_name: string; date: string;
  reason: string; notes?: string | null; marked_by: string; is_active: boolean; created_at: string;
}

interface CalEvent {
  id: string; calendar_type: CalendarType; title: string; description?: string;
  start_time: string; end_time: string; all_day: boolean;
  staff_id?: string; client_id?: string; client_name?: string;
  client_phone?: string; client_email?: string; case_number?: string;
  court_location?: string; judge_name?: string; trustee_name?: string;
  status: EventStatus; created_at: string;
  department?: string;
  reschedule_flag?: boolean; reschedule_reason?: string;
  reassigned_from_staff_id?: string; reassigned_to_staff_id?: string;
}

interface HearingReassignment {
  id: string;
  event_id: string;
  from_staff_id: string;
  to_staff_id: string;
  status: "pending_acceptance" | "accepted" | "declined";
  requested_at: string;
  responded_at?: string;
}

// ─── Calendar type config ──────────────────────────────────────────────────────

const CAL_CONFIG: Record<CalendarType, { label: string; color: string; bg: string; border: string; text: string; icon: React.ReactNode; maxPerHour?: number }> = {
  intake:         { label: "Intake",           color: "#3b82f6", bg: "bg-blue-500",    border: "border-blue-500/40",   text: "text-blue-400",   icon: <Users className="w-3.5 h-3.5" />,    maxPerHour: 5 },
  doc_review:     { label: "Doc Review",        color: "#10b981", bg: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-400", icon: <FileText className="w-3.5 h-3.5" />, maxPerHour: 4 },
  signing:        { label: "Signing",           color: "#f59e0b", bg: "bg-amber-500",   border: "border-amber-500/40",  text: "text-amber-400",  icon: <Edit2 className="w-3.5 h-3.5" /> },
  court_hearing:  { label: "Court Hearing",     color: "#ef4444", bg: "bg-red-500",     border: "border-red-500/40",    text: "text-red-400",    icon: <Scale className="w-3.5 h-3.5" /> },
  court_deadline: { label: "Court Deadline",    color: "#f97316", bg: "bg-orange-500",  border: "border-orange-500/40", text: "text-orange-400", icon: <Bell className="w-3.5 h-3.5" /> },
};

const STATUS_CONFIG: Record<EventStatus, { label: string; cls: string }> = {
  scheduled:   { label: "Scheduled",   cls: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  confirmed:   { label: "Confirmed",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  completed:   { label: "Completed",   cls: "text-slate-400 bg-slate-800 border-slate-700" },
  cancelled:   { label: "Cancelled",   cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  rescheduled: { label: "Rescheduled", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  no_show:     { label: "No Show",     cls: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHAPTERS = ["Chapter 7", "Chapter 13"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}
function fmtTime(ts: string) {
  return fmt(new Date(ts), { hour: "numeric", minute: "2-digit", hour12: true });
}
function fmtDate(ts: string) {
  return fmt(new Date(ts), { month: "short", day: "numeric", year: "numeric" });
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date) {
  const c = new Date(d); c.setDate(c.getDate() - c.getDay()); c.setHours(0,0,0,0); return c;
}
function addDays(d: Date, n: number) {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ─── Pill for event on calendar grid ─────────────────────────────────────────

function EventPill({ event, onClick }: { event: CalEvent; onClick: () => void }) {
  const cfg = CAL_CONFIG[event.calendar_type];
  const isDead = event.calendar_type === "court_deadline";
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`w-full text-left px-2 py-1 rounded text-[10px] font-semibold leading-tight truncate transition-all hover:brightness-110 active:scale-95 ${
        isDead
          ? "bg-orange-500/15 border border-orange-500/30 text-orange-300"
          : `border ${cfg.border} text-white`
      }`}
      style={isDead ? {} : { backgroundColor: cfg.color + "28", borderColor: cfg.color + "55", color: cfg.color }}
    >
      {!event.all_day && !isDead && (
        <span className="opacity-75 mr-1">{fmtTime(event.start_time)}</span>
      )}
      {event.title}
    </button>
  );
}

// ─── Reassign Hearing Modal ────────────────────────────────────────────────────

function ReassignModal({ event, staff, onClose, onSaved }: {
  event: CalEvent; staff: StaffMember[]; onClose: () => void; onSaved: () => void;
}) {
  const attorneys = staff.filter(s => s.role === "attorney" && s.is_active && s.id !== event.staff_id);
  const [toStaffId, setToStaffId] = useState(attorneys[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!toStaffId) return;
    setSaving(true);
    await api.post("hearing_reassignments", {
      event_id: event.id,
      from_staff_id: event.staff_id ?? null,
      to_staff_id: toStaffId,
      status: "pending_acceptance",
      requested_at: new Date().toISOString(),
    });
    setSaving(false);
    setDone(true);
  }

  const toAtty = staff.find(s => s.id === toStaffId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowRight className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">Reassign Hearing</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        {!done ? (
          <>
            <div className="px-5 py-4 space-y-4">
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-red-400 mb-0.5">Hearing to Reassign</p>
                <p className="text-sm text-white font-bold">{event.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{fmtDate(event.start_time)} · {fmtTime(event.start_time)}</p>
                {event.court_location && <p className="text-xs text-slate-500 mt-0.5">{event.court_location}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Assign to Attorney</label>
                {attorneys.length === 0 ? (
                  <p className="text-xs text-slate-500">No other attorneys available.</p>
                ) : (
                  <select
                    value={toStaffId}
                    onChange={e => setToStaffId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5"
                  >
                    {attorneys.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
                <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  A reassignment request will be sent to {toAtty?.name ?? "the selected attorney"}. They must accept before the hearing moves to their calendar. You will remain assigned until acceptance.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button onClick={submit} disabled={saving || !toStaffId || attorneys.length === 0} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {saving ? "Sending…" : "Send Request"}
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white">Request Sent</p>
            <p className="text-xs text-slate-400">
              {toAtty?.name} has been notified and must accept to take over this hearing. You will be notified once they respond.
            </p>
            <button onClick={() => { onSaved(); onClose(); }} className="mt-2 bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-2 rounded-xl text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attorney Availability Modal ──────────────────────────────────────────────

function AttorneyAvailabilityModal({ staff, availabilities, onClose, onSaved }: {
  staff: StaffMember[];
  availabilities: AttorneyAvailability[];
  onClose: () => void;
  onSaved: (updated: AttorneyAvailability[]) => void;
}) {
  const attorneys = staff.filter(s => s.role === "attorney");
  const [selectedId, setSelectedId] = useState(attorneys[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const currentAvail = availabilities.find(a => a.staff_id === selectedId) ?? {
    staff_id: selectedId,
    chapters_handled: ["Chapter 7"],
    signing_days: [1, 2, 3, 4, 5],
    max_signings_per_day: 4,
    hearing_buffer_before_minutes: 120,
    hearing_buffer_after_minutes: 90,
  };

  const [form, setForm] = useState<Omit<AttorneyAvailability, "id">>({ ...currentAvail });

  // Sync form when attorney selection changes
  function selectAttorney(id: string) {
    setSelectedId(id);
    const av = availabilities.find(a => a.staff_id === id) ?? {
      staff_id: id,
      chapters_handled: ["Chapter 7"],
      signing_days: [1, 2, 3, 4, 5],
      max_signings_per_day: 4,
      hearing_buffer_before_minutes: 120,
      hearing_buffer_after_minutes: 90,
    };
    setForm({ ...av, staff_id: id });
  }

  function toggleChapter(ch: string) {
    setForm(p => ({
      ...p,
      chapters_handled: p.chapters_handled.includes(ch)
        ? p.chapters_handled.filter(c => c !== ch)
        : [...p.chapters_handled, ch],
    }));
  }

  function toggleDay(day: number) {
    setForm(p => ({
      ...p,
      signing_days: p.signing_days.includes(day)
        ? p.signing_days.filter(d => d !== day)
        : [...p.signing_days, day].sort(),
    }));
  }

  async function save() {
    setSaving(true);
    const result = await api.upsert("attorney_availability", form, "staff_id");
    if (result?.[0]) {
      const updated = [
        ...availabilities.filter(a => a.staff_id !== selectedId),
        result[0],
      ];
      onSaved(updated);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">Attorney Availability</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Attorney selector */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Attorney</label>
            <div className="flex flex-wrap gap-2">
              {attorneys.map(a => (
                <button
                  key={a.id}
                  onClick={() => selectAttorney(a.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    selectedId === a.id
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                      : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.name}
                </button>
              ))}
            </div>
            {attorneys.length === 0 && (
              <p className="text-xs text-slate-600">No attorneys found in staff.</p>
            )}
          </div>

          {selectedId && (
            <>
              {/* Chapters handled */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Chapters Handled</label>
                <div className="flex gap-2">
                  {CHAPTERS.map(ch => (
                    <button
                      key={ch}
                      onClick={() => toggleChapter(ch)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        form.chapters_handled.includes(ch)
                          ? "border-sky-400/50 bg-sky-400/10 text-sky-300"
                          : "border-slate-700 text-slate-500 hover:border-slate-600"
                      }`}
                    >
                      <Scale className="w-3 h-3" />
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {/* Signing days */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Signing Days</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_NAMES.map((name, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        form.signing_days.includes(idx)
                          ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                          : "border-slate-700 text-slate-600 hover:border-slate-600"
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max signings per day */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Max Signings Per Day</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={1} max={10} value={form.max_signings_per_day}
                    onChange={e => setForm(p => ({ ...p, max_signings_per_day: parseInt(e.target.value) }))}
                    className="flex-1 accent-amber-400"
                  />
                  <span className="text-base font-bold text-amber-400 w-6 text-center">{form.max_signings_per_day}</span>
                </div>
              </div>

              {/* Hearing buffer */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400">Hearing Buffer (No Signings Within…)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">Before Hearing</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={240} step={15} value={form.hearing_buffer_before_minutes}
                        onChange={e => setForm(p => ({ ...p, hearing_buffer_before_minutes: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-slate-500"
                      />
                      <span className="text-xs text-slate-500 flex-shrink-0">min</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">After Hearing</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={240} step={15} value={form.hearing_buffer_after_minutes}
                        onChange={e => setForm(p => ({ ...p, hearing_buffer_after_minutes: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-slate-500"
                      />
                      <span className="text-xs text-slate-500 flex-shrink-0">min</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-slate-800/50 rounded-xl px-3 py-2.5">
                  <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    The system will block signing appointments scheduled within {form.hearing_buffer_before_minutes} minutes before or {form.hearing_buffer_after_minutes} minutes after a court hearing for this attorney.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button onClick={save} disabled={saving || !selectedId} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Availability"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────

function EventModal({ event, staff, onClose, onUpdate, onReassign }: {
  event: CalEvent; staff: StaffMember[]; onClose: () => void;
  onUpdate: (id: string, updates: Partial<CalEvent>) => void;
  onReassign: (event: CalEvent) => void;
}) {
  const cfg  = CAL_CONFIG[event.calendar_type];
  const sCfg = STATUS_CONFIG[event.status];
  const assignedStaff = staff.find(s => s.id === event.staff_id);
  const [editing, setEditing] = useState(false);
  const [status, setStatus]   = useState(event.status);

  async function saveStatus() {
    await api.patch("calendar_events", event.id, { status, updated_at: new Date().toISOString() });
    onUpdate(event.id, { status });
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800" style={{ background: cfg.color + "14" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: cfg.color + "22" }}>
                <span style={{ color: cfg.color }}>{cfg.icon}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sCfg.cls}`}>{sCfg.label}</span>
                </div>
                <h3 className="text-base font-bold text-white leading-snug">{event.title}</h3>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Time */}
          <div className="flex items-center gap-2.5 text-sm">
            <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-slate-300">
              {event.all_day
                ? fmtDate(event.start_time)
                : `${fmtDate(event.start_time)} · ${fmtTime(event.start_time)} – ${fmtTime(event.end_time)}`
              }
            </span>
          </div>

          {/* Client */}
          {event.client_name && (
            <div className="flex items-center gap-2.5 text-sm">
              <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <span className="text-slate-300 font-medium">{event.client_name}</span>
                {event.case_number && <span className="text-slate-600 ml-2">Case #{event.case_number}</span>}
              </div>
            </div>
          )}

          {/* Staff */}
          {assignedStaff && (
            <div className="flex items-center gap-2.5 text-sm">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: assignedStaff.color }} />
              <span className="text-slate-300">{assignedStaff.name}</span>
              <span className="text-slate-600 text-xs capitalize">{assignedStaff.role.replace("_", " ")}</span>
            </div>
          )}

          {/* Court details */}
          {event.court_location && (
            <div className="flex items-start gap-2.5 text-sm">
              <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-slate-300">{event.court_location}</p>
                {event.trustee_name && <p className="text-slate-500 text-xs">Trustee: {event.trustee_name}</p>}
                {event.judge_name    && <p className="text-slate-500 text-xs">Judge: {event.judge_name}</p>}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-2.5 text-sm">
              <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-slate-400 leading-relaxed">{event.description}</p>
            </div>
          )}

          {/* Court deadline callout */}
          {event.calendar_type === "court_deadline" && (
            <div className="flex items-start gap-2.5 bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2.5">
              <Bell className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300 font-semibold">This is a court deadline — missing this date may result in case dismissal.</p>
            </div>
          )}

          {/* Reassign button for court hearings */}
          {event.calendar_type === "court_hearing" && (
            <div className="flex items-start gap-2.5 bg-red-500/6 border border-red-500/20 rounded-xl px-3 py-2.5">
              <Scale className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-400 mb-2">Need to delegate this hearing to another attorney?</p>
                <button
                  onClick={() => { onReassign(event); onClose(); }}
                  className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                >
                  <ArrowRight className="w-3 h-3" /> Reassign to Another Attorney
                </button>
              </div>
            </div>
          )}

          {/* Status editor */}
          <div className="pt-1 border-t border-slate-800">
            {editing ? (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as EventStatus)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5"
                >
                  {(Object.keys(STATUS_CONFIG) as EventStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
                <button onClick={saveStatus} className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors">
                <Edit2 className="w-3 h-3" /> Update status
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Event Modal ──────────────────────────────────────────────────────────

function NewEventModal({ defaultDate, staff, availabilities, onClose, onSave }: {
  defaultDate: Date; staff: StaffMember[]; availabilities: AttorneyAvailability[];
  onClose: () => void; onSave: (event: CalEvent) => void;
}) {
  const [form, setForm] = useState({
    calendar_type: "intake" as CalendarType,
    title: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    case_number: "",
    court_location: "",
    trustee_name: "",
    staff_id: "",
    date: toLocalDateStr(defaultDate),
    start_hour: "09",
    start_min: "00",
    duration: "60",
    all_day: false,
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const up = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setError("");
    setSaving(true);

    try {
      const startDt = new Date(`${form.date}T${form.start_hour}:${form.start_min}:00`);
      const endDt   = new Date(startDt.getTime() + parseInt(form.duration) * 60000);

      // ── Signing validation ────────────────────────────────────────────────
      if (form.calendar_type === "signing" && form.staff_id) {
        const avail = availabilities.find(a => a.staff_id === form.staff_id);

        if (avail) {
          const dayOfWeek = startDt.getDay();

          // Check signing day
          if (!avail.signing_days.includes(dayOfWeek)) {
            const allowedDays = avail.signing_days.map(d => DAY_NAMES[d]).join(", ");
            setSaving(false);
            setError(`This attorney does not do signings on ${DAY_NAMES[dayOfWeek]}s. Allowed days: ${allowedDays}.`);
            return;
          }

          // Check max signings per day
          const dayStr = form.date;
          const existingSignings = await api.get(
            `calendar_events?staff_id=eq.${form.staff_id}&calendar_type=eq.signing&start_time=gte.${dayStr}T00:00:00&start_time=lt.${dayStr}T23:59:59&status=in.(scheduled,confirmed)`
          ) as CalEvent[];
          if ((existingSignings ?? []).length >= avail.max_signings_per_day) {
            setSaving(false);
            setError(`Maximum signings per day (${avail.max_signings_per_day}) reached for this attorney on ${dayStr}.`);
            return;
          }

          // Check hearing buffer
          const hearings = await api.get(
            `calendar_events?staff_id=eq.${form.staff_id}&calendar_type=eq.court_hearing&start_time=gte.${dayStr}T00:00:00&start_time=lt.${dayStr}T23:59:59&status=in.(scheduled,confirmed,completed)`
          ) as CalEvent[];

          for (const hearing of (hearings ?? [])) {
            const hearingStart = new Date(hearing.start_time).getTime();
            const hearingEnd   = new Date(hearing.end_time).getTime();
            const bufBefore    = avail.hearing_buffer_before_minutes * 60000;
            const bufAfter     = avail.hearing_buffer_after_minutes  * 60000;
            const signingStart = startDt.getTime();
            const signingEnd   = endDt.getTime();

            // Signing cannot start within bufBefore of hearing start, or within bufAfter of hearing end
            const tooClose = (
              signingStart >= (hearingStart - bufBefore) && signingStart <= (hearingEnd + bufAfter)
            ) || (
              signingEnd > (hearingStart - bufBefore) && signingEnd <= (hearingEnd + bufAfter)
            );

            if (tooClose) {
              const hTime = fmtTime(hearing.start_time);
              setSaving(false);
              setError(
                `Conflict with court hearing at ${hTime}. No signings allowed within ${avail.hearing_buffer_before_minutes} min before or ${avail.hearing_buffer_after_minutes} min after a hearing.`
              );
              return;
            }
          }
        }
      }

      const payload = {
        calendar_type:  form.calendar_type,
        title:          form.title,
        client_name:    form.client_name || null,
        client_phone:   form.client_phone || null,
        client_email:   form.client_email || null,
        case_number:    form.case_number || null,
        court_location: form.court_location || null,
        trustee_name:   form.trustee_name || null,
        staff_id:       form.staff_id || null,
        start_time:     startDt.toISOString(),
        end_time:       endDt.toISOString(),
        all_day:        form.calendar_type === "court_deadline",
        description:    form.description || null,
        status:         "scheduled",
      };
      const result = await api.post("calendar_events", payload);
      if (result?.[0]) { onSave(result[0]); onClose(); }
    } catch { setError("Failed to save. Please try again."); }
    setSaving(false);
  }

  const showCourt = form.calendar_type === "court_hearing" || form.calendar_type === "court_deadline";
  const isSigningWithAtty = form.calendar_type === "signing" && form.staff_id;
  const attyAvail = isSigningWithAtty ? availabilities.find(a => a.staff_id === form.staff_id) : null;
  const attorneys = staff.filter(s => s.role === "attorney" && s.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">New Calendar Event</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Calendar type */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Calendar</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(Object.keys(CAL_CONFIG) as CalendarType[]).map(t => (
                <button
                  key={t}
                  onClick={() => up("calendar_type", t)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-[10px] font-bold transition-all`}
                  style={form.calendar_type === t ? { borderColor: CAL_CONFIG[t].color, backgroundColor: CAL_CONFIG[t].color + "18", color: CAL_CONFIG[t].color } : { borderColor: "#334155", color: "#64748b" }}
                >
                  {CAL_CONFIG[t].icon}
                  <span className="text-center leading-tight">{CAL_CONFIG[t].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Title *</label>
            <input value={form.title} onChange={e => up("title", e.target.value)} placeholder="Event title" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Date</label>
              <input type="date" value={form.date} onChange={e => up("date", e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500" />
            </div>
            {form.calendar_type !== "court_deadline" && <>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Start</label>
                <div className="flex gap-1">
                  <select value={form.start_hour} onChange={e => up("start_hour", e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-2 py-2.5">
                    {Array.from({length:12},(_,i)=>String(i+8).padStart(2,"0")).map(h=><option key={h}>{h}</option>)}
                  </select>
                  <select value={form.start_min} onChange={e => up("start_min", e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-2 py-2.5">
                    {["00","15","30","45"].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Duration</label>
                <select value={form.duration} onChange={e => up("duration", e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-2 py-2.5">
                  {[["30","30 min"],["60","1 hr"],["90","1.5 hr"],["120","2 hr"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </>}
          </div>

          {/* Client */}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Client Name</label>
              <input value={form.client_name} onChange={e => up("client_name", e.target.value)} placeholder="Full name" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Phone</label>
              <input value={form.client_phone} onChange={e => up("client_phone", e.target.value)} placeholder="(555) 000-0000" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Email</label>
              <input value={form.client_email} onChange={e => up("client_email", e.target.value)} placeholder="email@example.com" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
            </div>
          </div>

          {/* Case number */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Case Number</label>
            <input value={form.case_number} onChange={e => up("case_number", e.target.value)} placeholder="e.g. 24-12345 or Pending" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
          </div>

          {/* Court fields */}
          {showCourt && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Court Location</label>
                <input value={form.court_location} onChange={e => up("court_location", e.target.value)} placeholder="US Bankruptcy Court, N.D. Texas" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Trustee Name</label>
                <input value={form.trustee_name} onChange={e => up("trustee_name", e.target.value)} placeholder="Trustee name" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500" />
              </div>
            </div>
          )}

          {/* Staff assignment */}
          {(form.calendar_type === "intake" || form.calendar_type === "doc_review" || form.calendar_type === "signing") && (
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                {form.calendar_type === "signing" ? "Assign Attorney" : "Assign Staff"}
              </label>
              <select
                value={form.staff_id}
                onChange={e => up("staff_id", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5"
              >
                <option value="">Unassigned</option>
                {(form.calendar_type === "signing" ? attorneys : staff.filter(s => s.is_active)).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role.replace("_"," ")})</option>
                ))}
              </select>

              {/* Attorney availability hint for signings */}
              {attyAvail && (
                <div className="mt-2 flex items-start gap-2 bg-slate-800/60 rounded-xl px-3 py-2">
                  <Shield className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <p>Signing days: {attyAvail.signing_days.map(d => DAY_NAMES[d].slice(0,3)).join(", ")}</p>
                    <p>Max per day: {attyAvail.max_signings_per_day} · Buffer: {attyAvail.hearing_buffer_before_minutes}min before / {attyAvail.hearing_buffer_after_minutes}min after hearings</p>
                    <p>Chapters: {attyAvail.chapters_handled.join(", ") || "Not set"}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Notes</label>
            <textarea value={form.description} onChange={e => up("description", e.target.value)} rows={2} placeholder="Optional notes…" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {saving ? "Checking…" : "Add Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PTO Request Modal ────────────────────────────────────────────────────────

function PtoModal({ staff, currentStaffId, onClose, onSaved }: {
  staff: StaffMember[]; currentStaffId: string; onClose: () => void; onSaved: () => void;
}) {
  const [staffId, setStaffId]   = useState(currentStaffId);
  const [start, setStart]       = useState(toLocalDateStr(new Date()));
  const [end, setEnd]           = useState(toLocalDateStr(addDays(new Date(), 1)));
  const [reason, setReason]     = useState("");
  const [saving, setSaving]     = useState(false);

  async function submit() {
    setSaving(true);
    await api.post("pto_requests", { staff_id: staffId, start_date: start, end_date: end, reason, status: "pending" });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Coffee className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">PTO Request</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Staff Member</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5">
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Start Date</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">End Date</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-slate-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Vacation, personal days, etc." className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving || !staffId} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sick Status Banner ───────────────────────────────────────────────────────

function SickStatusBanner({ staff, events, onRefresh }: {
  staff: StaffMember[];
  events: CalEvent[];
  onRefresh: () => void;
}) {
  const [overrides, setOverrides] = useState<SickOverride[]>([]);
  const [expanded, setExpanded]   = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Record<string, string>>({});

  const today = toLocalDateStr(new Date());

  const load = useCallback(async () => {
    const rows = await api.get(`staff_sick_overrides?date=eq.${today}&is_active=eq.true`);
    setOverrides(rows ?? []);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  if (overrides.length === 0) return null;

  const sickIds = new Set(overrides.map(o => o.staff_id));
  const flaggedEvents = events.filter(e => e.reschedule_flag && sickIds.has(e.staff_id ?? ""));
  const availableStaff = staff.filter(s => s.is_active && !sickIds.has(s.id));

  async function reassign(eventId: string, toStaffId: string, fromStaffId: string) {
    setResolving(eventId);
    const toStaff = staff.find(s => s.id === toStaffId);
    await api.patch("calendar_events", eventId, {
      staff_id:                  toStaffId,
      reschedule_flag:           false,
      reschedule_reason:         null,
      reassigned_from_staff_id:  fromStaffId,
      reassigned_to_staff_id:    toStaffId,
      status:                    "scheduled",
    });
    // Log reassignment
    await api.post("hearing_reassignments", {
      event_id:       eventId,
      from_staff_id:  fromStaffId,
      to_staff_id:    toStaffId,
      status:         "accepted",
      requested_at:   new Date().toISOString(),
      responded_at:   new Date().toISOString(),
    });
    setResolving(null);
    onRefresh();
  }

  async function markRescheduled(eventId: string) {
    setResolving(eventId);
    await api.patch("calendar_events", eventId, {
      status:            "rescheduled",
      reschedule_flag:   false,
      reschedule_reason: null,
    });
    setResolving(null);
    onRefresh();
  }

  return (
    <div className="mx-4 sm:mx-6 mt-3 rounded-2xl border border-red-500/30 bg-red-950/20 overflow-hidden">
      {/* Banner header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-300">
            <Thermometer className="w-4 h-4" />
            {overrides.length} Staff Out Sick Today
          </span>
          <div className="flex items-center gap-1.5">
            {overrides.map(o => (
              <span key={o.id} className="text-[10px] font-bold text-white bg-red-500/20 border border-red-500/30 rounded-full px-2 py-0.5">
                {o.staff_name}
                {o.marked_by === "admin" ? " (admin)" : ""}
              </span>
            ))}
          </div>
          {flaggedEvents.length > 0 && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 rounded-full px-2 py-0.5">
              {flaggedEvents.length} appointment{flaggedEvents.length !== 1 ? "s" : ""} need action
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-red-500/20 divide-y divide-red-500/10">
          {/* Who's out */}
          <div className="px-4 py-3 flex items-center gap-6 flex-wrap">
            {overrides.map(o => {
              const member = staff.find(s => s.id === o.staff_id);
              return (
                <div key={o.id} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: member?.color ?? "#64748b" }}>
                    {o.staff_name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{o.staff_name}</p>
                    <p className="text-[10px] text-slate-500">{member?.role.replace("_"," ") ?? "Staff"} · {o.marked_by === "admin" ? "Marked by admin" : "Called in"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flagged appointments */}
          {flaggedEvents.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">No appointments scheduled for absent staff today — no action needed.</div>
          ) : (
            <div className="divide-y divide-red-500/10">
              <div className="px-4 py-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs font-bold text-amber-300">Appointments Needing Reassignment or Rescheduling</p>
              </div>
              {flaggedEvents.map(ev => {
                const fromStaff = staff.find(s => s.id === ev.staff_id);
                const isBusy    = resolving === ev.id;
                const targetId  = reassignTarget[ev.id] ?? availableStaff[0]?.id ?? "";
                const startTime = new Date(ev.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={ev.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{startTime}</span>
                        <p className="text-xs font-semibold text-white truncate">{ev.title}</p>
                        {ev.client_name && <span className="text-[10px] text-slate-400 truncate">{ev.client_name}</span>}
                      </div>
                      <p className="text-[10px] text-red-400 mt-0.5">Originally: {fromStaff?.name ?? "Unknown staff"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Reassign to selector */}
                      {availableStaff.length > 0 && (
                        <select
                          value={targetId}
                          onChange={e => setReassignTarget(prev => ({ ...prev, [ev.id]: e.target.value }))}
                          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2 py-1.5 focus:outline-none"
                        >
                          {availableStaff.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => targetId && ev.staff_id && reassign(ev.id, targetId, ev.staff_id)}
                        disabled={isBusy || !targetId || !ev.staff_id}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50 rounded-xl px-2.5 py-1.5 transition-colors"
                      >
                        {isBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                        Reassign
                      </button>
                      <button
                        onClick={() => markRescheduled(ev.id)}
                        disabled={isBusy}
                        className="flex items-center gap-1 text-[10px] font-bold text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 disabled:opacity-50 rounded-xl px-2.5 py-1.5 transition-colors"
                      >
                        {isBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
                        Reschedule
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sick Report Modal ────────────────────────────────────────────────────────

function SickModal({ staff, onClose, onSaved }: {
  staff: StaffMember[]; onClose: () => void; onSaved: (report: SickReport) => void;
}) {
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [result, setResult]   = useState<SickReport | null>(null);
  const [markedBy, setMarkedBy] = useState<"self" | "admin">("self");

  async function submit() {
    setSaving(true);
    const today     = toLocalDateStr(new Date());
    const sickStaff = staff.find(s => s.id === staffId);

    // 1. Check if already marked sick today to avoid duplicates
    const existing = await api.get(`staff_sick_overrides?staff_id=eq.${staffId}&date=eq.${today}&is_active=eq.true`);

    let overrideId: string | null = null;
    if (!existing?.length) {
      // 2. Write to staff_sick_overrides for unified tracking
      const overrideRes = await api.post("staff_sick_overrides", {
        staff_id:   staffId,
        staff_name: sickStaff?.name ?? "Unknown",
        date:       today,
        reason:     "sick",
        notes:      notes || null,
        marked_by:  markedBy,
        is_active:  true,
      });
      overrideId = overrideRes?.[0]?.id ?? null;

      // 3. Also write to intake_staff_time_off for intake calendar blocking
      await api.post("intake_staff_time_off", {
        staff_id:      staffId,
        staff_name:    sickStaff?.name ?? "Unknown",
        date:          today,
        time_off_type: "full_day",
        reason_type:   "sick",
        reason:        notes || "Sick day",
        approved:      true,
      });
    } else {
      overrideId = existing[0].id;
    }

    // 4. Find today's affected appointments
    const todayEvents: CalEvent[] = await api.get(
      `calendar_events?staff_id=eq.${staffId}&start_time=gte.${today}T00:00:00&start_time=lt.${today}T23:59:59&status=in.(scheduled,confirmed)`
    ) ?? [];
    const count = todayEvents.length;

    // 5. Determine coverage
    const sameCoverage = staff.filter(s => s.is_active && s.id !== staffId && s.role === sickStaff?.role).length;
    const coverage = sameCoverage >= 1 ? "adequate" : "rescheduled";

    // 6. Flag affected events in calendar_events
    const flaggedIds: string[] = [];
    for (const ev of todayEvents) {
      await api.patch("calendar_events", ev.id, {
        reschedule_flag:   true,
        reschedule_reason: `${sickStaff?.name ?? "Staff"} called in sick`,
      });
      flaggedIds.push(ev.id);
    }

    // 7. Create sick_report linked to override
    const res = await api.post("sick_reports", {
      staff_id:             staffId,
      report_date:          today,
      coverage_status:      coverage,
      affected_appt_count:  count,
      rescheduled_count:    coverage === "rescheduled" ? count : 0,
      notes,
      sick_override_id:     overrideId,
      flagged_event_ids:    flaggedIds,
      resolution:           count === 0 ? "no_action" : "pending",
    });

    if (res?.[0]) { setResult(res[0]); onSaved(res[0]); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Thermometer className="w-4 h-4 text-red-400" />
            <h3 className="text-base font-bold text-white">Report Sick Day</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {!result ? (
            <>
              <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                <Thermometer className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-snug">
                  The system checks today's appointments and flags them for rescheduling or reassignment. The absence is recorded firm-wide so all portals stay in sync.
                </p>
              </div>

              {/* Who is reporting */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMarkedBy("self")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${markedBy === "self" ? "bg-red-500/15 text-red-300 border-red-500/30" : "text-slate-500 border-slate-700 hover:border-slate-600"}`}
                >
                  Staff calling in (self)
                </button>
                <button
                  onClick={() => setMarkedBy("admin")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${markedBy === "admin" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "text-slate-500 border-slate-700 hover:border-slate-600"}`}
                >
                  Admin marking out
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Who is out sick today?</label>
                <select value={staffId} onChange={e => setStaffId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5">
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role.replace("_"," ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional context…" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none resize-none" />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className={`flex items-start gap-3 rounded-xl px-4 py-3.5 border ${
                result.coverage_status === "adequate"
                  ? "bg-emerald-500/8 border-emerald-500/25"
                  : "bg-red-500/8 border-red-500/25"
              }`}>
                {result.coverage_status === "adequate"
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`text-sm font-bold mb-1 ${result.coverage_status === "adequate" ? "text-emerald-400" : "text-red-400"}`}>
                    {result.coverage_status === "adequate" ? "Adequate Coverage — No Rescheduling Needed" : "Insufficient Coverage — Appointments Flagged"}
                  </p>
                  <p className="text-xs text-slate-400 leading-snug">
                    {result.affected_appt_count} appointment{result.affected_appt_count !== 1 ? "s" : ""} affected today.
                    {result.coverage_status === "rescheduled"
                      ? ` ${result.rescheduled_count} flagged for rescheduling — use the calendar banner to reassign or reschedule.`
                      : " Other staff can absorb these — no rescheduling required."
                    }
                  </p>
                </div>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Absence recorded firm-wide.</span> The intake calendar and firm calendar are now blocked for this staff member today. A sick status banner will appear on the calendar for all staff.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          {!result ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button onClick={submit} disabled={saving || !staffId} className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Thermometer className="w-3.5 h-3.5" />}
                {saving ? "Checking Coverage…" : "Report Sick"}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-2 rounded-xl text-sm">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PTO Requests Panel ────────────────────────────────────────────────────────

function PtoPanelModal({ ptoList, staff, onClose, onApprove, onDeny, onNewRequest }: {
  ptoList: PtoRequest[]; staff: StaffMember[]; onClose: () => void;
  onApprove: (id: string) => void; onDeny: (id: string) => void; onNewRequest: () => void;
}) {
  const pending  = ptoList.filter(p => p.status === "pending");
  const [tab, setTab] = useState<"pending"|"all">("pending");

  function staffName(id: string) { return staff.find(s => s.id === id)?.name ?? "Unknown"; }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Coffee className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">PTO Requests</h3>
            {pending.length > 0 && <span className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full">{pending.length} pending</span>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex border-b border-slate-800">
          {(["pending","all"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab===t ? "text-amber-400 border-b-2 border-amber-400 bg-amber-400/5" : "text-slate-500 hover:text-slate-300"}`}>
              {t === "pending" ? `Pending (${pending.length})` : `All (${ptoList.length})`}
            </button>
          ))}
        </div>

        <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-800">
          {(tab === "pending" ? pending : ptoList).length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-600 text-sm">No {tab === "pending" ? "pending " : ""}requests.</div>
          ) : (
            (tab === "pending" ? pending : ptoList).map(req => (
              <div key={req.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-white">{staffName(req.staff_id)}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        req.status === "pending"  ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                        req.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                                                    "text-red-400 bg-red-500/10 border-red-500/20"
                      }`}>{req.status}</span>
                    </div>
                    <p className="text-xs text-slate-400">{req.start_date} → {req.end_date}</p>
                    {req.reason && <p className="text-xs text-slate-600 mt-0.5 italic">{req.reason}</p>}
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => onApprove(req.id)} className="flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => onDeny(req.id)} className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                        <XCircle className="w-3 h-3" /> Deny
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex justify-between items-center">
          <button onClick={onNewRequest} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <Plus className="w-3.5 h-3.5" /> New PTO Request
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({ year, month, events, ptoApproved, staff, selectedCals, onDayClick, onEventClick }: {
  year: number; month: number; events: CalEvent[]; ptoApproved: PtoRequest[];
  staff: StaffMember[]; selectedCals: Set<CalendarType>;
  onDayClick: (d: Date) => void; onEventClick: (e: CalEvent) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();

  function dayEvents(d: Date) {
    return events.filter(e => {
      if (!selectedCals.has(e.calendar_type)) return false;
      return sameDay(new Date(e.start_time), d);
    });
  }

  function ptoOnDay(d: Date) {
    return staff.filter(s =>
      ptoApproved.some(p => p.staff_id === s.id && p.status === "approved" && new Date(p.start_date) <= d && new Date(p.end_date) >= d)
    );
  }

  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b border-slate-800">
        {DAYS.map(d => <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">{d}</div>)}
      </div>
      <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${cells.length/7}, minmax(0,1fr))` }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="border-r border-b border-slate-800/50 bg-slate-950/30" />;
          const evs  = dayEvents(d);
          const ptos = ptoOnDay(d);
          const isTd = sameDay(d, today);
          const isWk = d.getDay() === 0 || d.getDay() === 6;

          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={`border-r border-b border-slate-800/60 p-1 cursor-pointer transition-colors hover:bg-slate-800/30 min-h-[80px] relative ${isWk ? "bg-slate-900/20" : ""}`}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full leading-none ${
                  isTd ? "bg-amber-400 text-slate-950" : "text-slate-500 hover:text-slate-300"
                }`}>{d.getDate()}</span>
                {ptos.length > 0 && (
                  <div className="flex gap-0.5">
                    {ptos.map(s => (
                      <div key={s.id} title={`${s.name} — PTO`} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map(e => <EventPill key={e.id} event={e} onClick={() => onEventClick(e)} />)}
                {evs.length > 3 && <p className="text-[9px] text-slate-600 pl-1">+{evs.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ weekStart, events, selectedCals, onEventClick, onSlotClick }: {
  weekStart: Date; events: CalEvent[]; selectedCals: Set<CalendarType>;
  onEventClick: (e: CalEvent) => void; onSlotClick: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 10 }, (_, i) => i + 8);
  const today = new Date();

  function eventsAt(d: Date, hr: number) {
    return events.filter(e => {
      if (!selectedCals.has(e.calendar_type)) return false;
      if (e.all_day) return false;
      const s = new Date(e.start_time);
      return sameDay(s, d) && s.getHours() === hr;
    });
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid border-b border-slate-800 sticky top-0 bg-[#0a0e1a] z-10" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
        <div />
        {days.map((d, i) => (
          <div key={i} className={`py-2 text-center border-l border-slate-800 ${sameDay(d, today) ? "bg-amber-400/5" : ""}`}>
            <p className="text-[10px] font-bold text-slate-600 uppercase">{fmt(d, { weekday: "short" })}</p>
            <p className={`text-base font-bold mt-0.5 ${sameDay(d, today) ? "text-amber-400" : "text-slate-400"}`}>{d.getDate()}</p>
          </div>
        ))}
      </div>
      {hours.map(hr => (
        <div key={hr} className="grid border-b border-slate-800/40" style={{ gridTemplateColumns: "52px repeat(7, 1fr)", minHeight: "64px" }}>
          <div className="px-2 pt-1 text-[10px] text-slate-700 font-medium text-right flex-shrink-0">
            {hr === 12 ? "12 PM" : hr > 12 ? `${hr-12} PM` : `${hr} AM`}
          </div>
          {days.map((d, di) => {
            const evs = eventsAt(d, hr);
            return (
              <div
                key={di}
                onClick={() => { const dt = new Date(d); dt.setHours(hr,0,0,0); onSlotClick(dt); }}
                className={`border-l border-slate-800/40 p-1 cursor-pointer hover:bg-slate-800/20 transition-colors ${sameDay(d, today) ? "bg-amber-400/3" : ""}`}
              >
                <div className="space-y-0.5">
                  {evs.map(e => <EventPill key={e.id} event={e} onClick={() => onEventClick(e)} />)}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ day, events, staff, selectedCals, onEventClick, onSlotClick }: {
  day: Date; events: CalEvent[]; staff: StaffMember[]; selectedCals: Set<CalendarType>;
  onEventClick: (e: CalEvent) => void; onSlotClick: (d: Date) => void;
}) {
  const hours = Array.from({ length: 10 }, (_, i) => i + 8);
  const dayEvs = events.filter(e => {
    if (!selectedCals.has(e.calendar_type)) return false;
    return sameDay(new Date(e.start_time), day);
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid border-b border-slate-800" style={{ gridTemplateColumns: "52px 1fr" }}>
        <div />
        <div className="py-3 border-l border-slate-800 px-4">
          <p className="text-sm font-bold text-white">{fmt(day, { weekday: "long", month: "long", day: "numeric" })}</p>
          <p className="text-xs text-slate-500 mt-0.5">{dayEvs.length} event{dayEvs.length !== 1 ? "s" : ""} scheduled</p>
        </div>
      </div>
      {hours.map(hr => {
        const slotEvs = dayEvs.filter(e => !e.all_day && new Date(e.start_time).getHours() === hr);
        return (
          <div key={hr} className="grid border-b border-slate-800/40 min-h-[72px]" style={{ gridTemplateColumns: "52px 1fr" }}>
            <div className="px-2 pt-2 text-[10px] text-slate-700 font-medium text-right">
              {hr === 12 ? "12 PM" : hr > 12 ? `${hr-12} PM` : `${hr} AM`}
            </div>
            <div
              onClick={() => { const dt = new Date(day); dt.setHours(hr,0,0,0); onSlotClick(dt); }}
              className="border-l border-slate-800/40 p-2 cursor-pointer hover:bg-slate-800/20 transition-colors space-y-1.5"
            >
              {slotEvs.map(e => {
                const cfg = CAL_CONFIG[e.calendar_type];
                const assignedStaff = staff.find(s => s.id === e.staff_id);
                return (
                  <div
                    key={e.id}
                    onClick={ev => { ev.stopPropagation(); onEventClick(e); }}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer hover:brightness-110 transition-all"
                    style={{ backgroundColor: cfg.color + "15", borderColor: cfg.color + "40" }}
                  >
                    <span style={{ color: cfg.color }} className="flex-shrink-0 mt-0.5">{cfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white leading-snug truncate">{e.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">{fmtTime(e.start_time)} – {fmtTime(e.end_time)}</span>
                        {e.client_name && <span className="text-[10px] text-slate-500">{e.client_name}</span>}
                        {assignedStaff && (
                          <span className="text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: assignedStaff.color }} />
                            <span className="text-slate-500">{assignedStaff.name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${STATUS_CONFIG[e.status].cls}`}>
                      {STATUS_CONFIG[e.status].label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Two-Week View ────────────────────────────────────────────────────────────

function TwoWeekView({ weekStart, events, selectedCals, onEventClick, onSlotClick }: {
  weekStart: Date; events: CalEvent[]; selectedCals: Set<CalendarType>;
  onEventClick: (e: CalEvent) => void; onSlotClick: (d: Date) => void;
}) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid border-b border-slate-800 sticky top-0 bg-[#0a0e1a] z-10" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
        <div />
        {days.slice(0, 7).map((d, i) => (
          <div key={i} className={`py-2 text-center border-l border-slate-800 ${sameDay(d, today) ? "bg-amber-400/5" : ""}`}>
            <p className="text-[10px] font-bold text-slate-600 uppercase">{fmt(d, { weekday: "short" })}</p>
            <p className={`text-sm font-bold mt-0.5 ${sameDay(d, today) ? "text-amber-400" : "text-slate-400"}`}>{d.getDate()}</p>
            <p className="text-[9px] text-slate-600">{fmt(d, { month: "short" })}</p>
          </div>
        ))}
      </div>
      {/* Week 1 rows */}
      {Array.from({ length: 10 }, (_, i) => i + 8).map(hr => (
        <div key={`w1-${hr}`} className="grid border-b border-slate-800/30" style={{ gridTemplateColumns: "44px repeat(7, 1fr)", minHeight: "52px" }}>
          <div className="px-1 pt-1 text-[9px] text-slate-700 font-medium text-right">{hr === 12 ? "12p" : hr > 12 ? `${hr-12}p` : `${hr}a`}</div>
          {days.slice(0, 7).map((d, di) => {
            const evs = events.filter(e => { if (!selectedCals.has(e.calendar_type) || e.all_day) return false; const s = new Date(e.start_time); return sameDay(s, d) && s.getHours() === hr; });
            return (
              <div key={di} onClick={() => { const dt = new Date(d); dt.setHours(hr,0,0,0); onSlotClick(dt); }} className={`border-l border-slate-800/30 p-0.5 cursor-pointer hover:bg-slate-800/20 transition-colors ${sameDay(d, today) ? "bg-amber-400/3" : ""}`}>
                {evs.map(e => <EventPill key={e.id} event={e} onClick={() => onEventClick(e)} />)}
              </div>
            );
          })}
        </div>
      ))}
      {/* Week 2 header */}
      <div className="grid border-b border-slate-700/60 sticky top-10 bg-[#0a0e1a] z-10 mt-1" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
        <div />
        {days.slice(7).map((d, i) => (
          <div key={i} className={`py-2 text-center border-l border-slate-800 ${sameDay(d, today) ? "bg-amber-400/5" : ""}`}>
            <p className="text-[10px] font-bold text-slate-600 uppercase">{fmt(d, { weekday: "short" })}</p>
            <p className={`text-sm font-bold mt-0.5 ${sameDay(d, today) ? "text-amber-400" : "text-slate-400"}`}>{d.getDate()}</p>
            <p className="text-[9px] text-slate-600">{fmt(d, { month: "short" })}</p>
          </div>
        ))}
      </div>
      {/* Week 2 rows */}
      {Array.from({ length: 10 }, (_, i) => i + 8).map(hr => (
        <div key={`w2-${hr}`} className="grid border-b border-slate-800/30" style={{ gridTemplateColumns: "44px repeat(7, 1fr)", minHeight: "52px" }}>
          <div className="px-1 pt-1 text-[9px] text-slate-700 font-medium text-right">{hr === 12 ? "12p" : hr > 12 ? `${hr-12}p` : `${hr}a`}</div>
          {days.slice(7).map((d, di) => {
            const evs = events.filter(e => { if (!selectedCals.has(e.calendar_type) || e.all_day) return false; const s = new Date(e.start_time); return sameDay(s, d) && s.getHours() === hr; });
            return (
              <div key={di} onClick={() => { const dt = new Date(d); dt.setHours(hr,0,0,0); onSlotClick(dt); }} className={`border-l border-slate-800/30 p-0.5 cursor-pointer hover:bg-slate-800/20 transition-colors ${sameDay(d, today) ? "bg-amber-400/3" : ""}`}>
                {evs.map(e => <EventPill key={e.id} event={e} onClick={() => onEventClick(e)} />)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Year View ────────────────────────────────────────────────────────────────

function YearView({ year, events, selectedCals, onMonthClick }: {
  year: number; events: CalEvent[]; selectedCals: Set<CalendarType>;
  onMonthClick: (month: number) => void;
}) {
  const today = new Date();
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map(m => {
          const firstDay = new Date(year, m, 1);
          const lastDay  = new Date(year, m + 1, 0);
          const startPad = firstDay.getDay();
          const monthEvs = events.filter(e => {
            if (!selectedCals.has(e.calendar_type)) return false;
            const d = new Date(e.start_time);
            return d.getFullYear() === year && d.getMonth() === m;
          });
          const eventDays = new Set(monthEvs.map(e => new Date(e.start_time).getDate()));
          const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1)];
          while (cells.length % 7 !== 0) cells.push(null);
          const isCurMonth = today.getMonth() === m && today.getFullYear() === year;

          return (
            <div key={m}
              onClick={() => onMonthClick(m)}
              className={`bg-[#0d1221] border rounded-2xl p-3 cursor-pointer hover:border-slate-600 transition-colors ${isCurMonth ? "border-amber-400/40" : "border-slate-800"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-bold ${isCurMonth ? "text-amber-400" : "text-slate-300"}`}>
                  {fmt(firstDay, { month: "long" })}
                </p>
                {monthEvs.length > 0 && (
                  <span className="text-[9px] font-bold text-slate-500 bg-slate-800 rounded px-1.5 py-0.5">{monthEvs.length}</span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <div key={i} className="text-[8px] text-slate-700 text-center font-bold pb-0.5">{d}</div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const isToday = isCurMonth && today.getDate() === day;
                  const hasEv = eventDays.has(day);
                  return (
                    <div key={i} className={`text-[9px] font-medium text-center py-0.5 rounded-sm leading-none ${isToday ? "bg-amber-400 text-slate-950 font-bold" : hasEv ? "text-sky-400 font-bold" : "text-slate-600"}`}>
                      {day}
                    </div>
                  );
                })}
              </div>
              {monthEvs.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {monthEvs.slice(0, 3).map(e => (
                    <div key={e.id} className="flex items-center gap-1 text-[9px] text-slate-500 truncate">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CAL_CONFIG[e.calendar_type].color }} />
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                  {monthEvs.length > 3 && <p className="text-[9px] text-slate-700">+{monthEvs.length - 3} more</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Appointment Reminder Banner ──────────────────────────────────────────────

interface ActiveReminder {
  event: CalEvent;
  minutesBefore: 5 | 15 | 30;
}

function ReminderBanner({ reminder, onDismiss }: { reminder: ActiveReminder; onDismiss: () => void }) {
  const cfg = CAL_CONFIG[reminder.event.calendar_type];
  const urgency = reminder.minutesBefore <= 5
    ? { bg: "bg-red-500/15 border-red-500/40", text: "text-red-300", label: "5 Minutes", icon: "🚨" }
    : reminder.minutesBefore <= 15
    ? { bg: "bg-amber-500/15 border-amber-500/40", text: "text-amber-300", label: "15 Minutes", icon: "⚠️" }
    : { bg: "bg-sky-500/10 border-sky-500/30", text: "text-sky-300", label: "30 Minutes", icon: "🔔" };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl shadow-2xl animate-in slide-in-from-top-2 ${urgency.bg}`}>
      <span className="text-lg flex-shrink-0">{urgency.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${urgency.text}`}>{urgency.label} Reminder</span>
          <span className="text-[10px] font-semibold uppercase" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        <p className="text-sm font-bold text-white truncate">{reminder.event.title}</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
          <span>{fmtTime(reminder.event.start_time)}</span>
          {reminder.event.client_name && <span>{reminder.event.client_name}</span>}
          {reminder.event.court_location && <span>{reminder.event.court_location}</span>}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Upcoming Appointments Panel ──────────────────────────────────────────────

function UpcomingPanel({ events, staff, onEventClick, onClose }: {
  events: CalEvent[]; staff: StaffMember[];
  onEventClick: (e: CalEvent) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const upcoming = events
    .filter(e => new Date(e.start_time) > now && e.status !== "cancelled" && e.status !== "completed")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 30);

  // Group by date
  const grouped: { dateLabel: string; evs: CalEvent[] }[] = [];
  for (const e of upcoming) {
    const label = fmt(new Date(e.start_time), { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const last = grouped[grouped.length - 1];
    if (last && last.dateLabel === label) last.evs.push(e);
    else grouped.push({ dateLabel: label, evs: [e] });
  }

  const today = new Date();
  const todayLabel = fmt(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const tomorrowLabel = fmt(addDays(today, 1), { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 sm:pr-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:w-96 bg-[#0d1221] border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <CalendarDays className="w-4 h-4 text-sky-400" />
          <h3 className="text-base font-bold text-white">Upcoming Appointments</h3>
          <span className="ml-auto text-xs text-slate-500">{upcoming.length} upcoming</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {upcoming.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No upcoming appointments</p>
            </div>
          ) : grouped.map(group => (
            <div key={group.dateLabel}>
              <div className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest sticky top-0 ${
                group.dateLabel === todayLabel ? "bg-amber-400/10 text-amber-400" :
                group.dateLabel === tomorrowLabel ? "bg-sky-500/8 text-sky-400" :
                "bg-slate-900/90 text-slate-500"
              }`}>
                {group.dateLabel === todayLabel ? "Today" : group.dateLabel === tomorrowLabel ? "Tomorrow" : group.dateLabel}
              </div>
              {group.evs.map(e => {
                const cfg = CAL_CONFIG[e.calendar_type];
                const assignedStaff = staff.find(s => s.id === e.staff_id);
                const minsUntil = Math.round((new Date(e.start_time).getTime() - Date.now()) / 60000);
                const isImminent = minsUntil <= 30;
                return (
                  <button
                    key={e.id}
                    onClick={() => { onEventClick(e); onClose(); }}
                    className="w-full text-left px-5 py-3 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: cfg.color + "22" }}>
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors">{e.title}</p>
                          {isImminent && group.dateLabel === todayLabel && (
                            <span className="text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 rounded-full px-1.5 py-0.5 flex-shrink-0">
                              {minsUntil <= 5 ? "NOW" : `${minsUntil}m`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{fmtTime(e.start_time)}{!e.all_day && ` – ${fmtTime(e.end_time)}`}</span>
                          {e.client_name && <span>{e.client_name}</span>}
                          {assignedStaff && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: assignedStaff.color }} />
                              {assignedStaff.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Calendar Component ──────────────────────────────────────────────────

const DEPT_CONFIG: Record<Department, { label: string; icon: React.ReactNode; calTypes: CalendarType[] }> = {
  all:        { label: "All",        icon: <LayoutGrid className="w-3.5 h-3.5" />,  calTypes: ["intake","doc_review","signing","court_hearing","court_deadline"] },
  intake:     { label: "Intake",     icon: <Users className="w-3.5 h-3.5" />,       calTypes: ["intake"] },
  paralegal:  { label: "Paralegal",  icon: <Layers className="w-3.5 h-3.5" />,      calTypes: ["doc_review"] },
  attorney:   { label: "Attorney",   icon: <Scale className="w-3.5 h-3.5" />,       calTypes: ["signing","court_hearing","court_deadline"] },
};

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Day", week: "Week", two_weeks: "2 Weeks", month: "Month", year: "Year",
};

export default function FirmCalendar() {
  const [viewMode, setViewMode]         = useState<ViewMode>("month");
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [events, setEvents]             = useState<CalEvent[]>([]);
  const [staff, setStaff]               = useState<StaffMember[]>([]);
  const [ptoList, setPtoList]           = useState<PtoRequest[]>([]);
  const [availabilities, setAvailabilities] = useState<AttorneyAvailability[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedEvent, setSelectedEvent]   = useState<CalEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const [showPtoPanel, setShowPtoPanel] = useState(false);
  const [showPtoForm, setShowPtoForm]   = useState(false);
  const [showSickModal, setShowSickModal] = useState(false);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [reassignEvent, setReassignEvent] = useState<CalEvent | null>(null);
  const [selectedCals, setSelectedCals] = useState<Set<CalendarType>>(
    new Set(["intake", "doc_review", "signing", "court_hearing", "court_deadline"])
  );
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [department, setDepartment]     = useState<Department>("all");
  const [activeReminders, setActiveReminders] = useState<ActiveReminder[]>([]);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weekStart = startOfWeek(currentDate);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [evs, st, pto, avail] = await Promise.all([
        api.get("calendar_events?order=start_time.asc&limit=500"),
        api.get("staff_members?order=name.asc"),
        api.get("pto_requests?order=created_at.desc"),
        api.get("attorney_availability?select=*"),
      ]);
      setEvents(evs ?? []);
      setStaff(st ?? []);
      setPtoList(pto ?? []);
      setAvailabilities(avail ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Reminder check: runs every 60 seconds, fires at 30/15/5 minutes before
  const checkReminders = useCallback(() => {
    const now = Date.now();
    const upcoming = events.filter(e =>
      e.status !== "cancelled" && e.status !== "completed" && !e.all_day
    );
    const newReminders: ActiveReminder[] = [];
    for (const event of upcoming) {
      const startMs = new Date(event.start_time).getTime();
      const minsUntil = (startMs - now) / 60000;
      for (const mb of [30, 15, 5] as const) {
        const key = `${event.id}-${mb}`;
        if (dismissedRef.current.has(key)) continue;
        if (minsUntil <= mb && minsUntil > mb - 1) {
          newReminders.push({ event, minutesBefore: mb });
          dismissedRef.current.add(key);
        }
      }
    }
    if (newReminders.length > 0) {
      setActiveReminders(prev => [...prev, ...newReminders]);
    }
  }, [events]);

  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  // When department changes, update selectedCals to match
  useEffect(() => {
    if (department !== "all") {
      setSelectedCals(new Set(DEPT_CONFIG[department].calTypes));
    } else {
      setSelectedCals(new Set(["intake", "doc_review", "signing", "court_hearing", "court_deadline"]));
    }
  }, [department]);

  const filteredEvents = events.filter(e =>
    selectedCals.has(e.calendar_type) &&
    (selectedStaff === "all" || e.staff_id === selectedStaff || !e.staff_id)
  );

  const ptoApproved = ptoList.filter(p => p.status === "approved");
  const ptoPending  = ptoList.filter(p => p.status === "pending").length;

  function toggleCal(t: CalendarType) {
    setSelectedCals(prev => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });
  }

  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (viewMode === "month")      d.setMonth(d.getMonth() + dir);
    else if (viewMode === "year")  d.setFullYear(d.getFullYear() + dir);
    else if (viewMode === "week")  d.setDate(d.getDate() + dir * 7);
    else if (viewMode === "two_weeks") d.setDate(d.getDate() + dir * 14);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }

  function headerLabel() {
    if (viewMode === "month") return fmt(currentDate, { month: "long", year: "numeric" });
    if (viewMode === "year")  return String(year);
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      return `${fmt(ws, { month: "short", day: "numeric" })} – ${fmt(we, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (viewMode === "two_weeks") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 13);
      return `${fmt(ws, { month: "short", day: "numeric" })} – ${fmt(we, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return fmt(currentDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  async function handlePtoApprove(id: string) {
    await api.patch("pto_requests", id, { status: "approved", approved_at: new Date().toISOString() });
    setPtoList(prev => prev.map(p => p.id === id ? { ...p, status: "approved" as PtoStatus } : p));
  }

  async function handlePtoDeny(id: string) {
    await api.patch("pto_requests", id, { status: "denied" });
    setPtoList(prev => prev.map(p => p.id === id ? { ...p, status: "denied" as PtoStatus } : p));
  }

  function handleEventUpdate(id: string, updates: Partial<CalEvent>) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }

  function dismissReminder(idx: number) {
    setActiveReminders(prev => prev.filter((_, i) => i !== idx));
  }

  const todayEvs = events.filter(e => sameDay(new Date(e.start_time), new Date()) && selectedCals.has(e.calendar_type));

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>

      {/* ── Reminder Banners ── */}
      {activeReminders.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-2 pointer-events-none">
          {activeReminders.map((r, i) => (
            <div key={`${r.event.id}-${r.minutesBefore}`} className="pointer-events-auto">
              <ReminderBanner reminder={r} onDismiss={() => dismissReminder(i)} />
            </div>
          ))}
        </div>
      )}

      {/* ── Top Bar ── */}
      <header className="bg-[#0d1221]/95 border-b border-slate-800/60 sticky top-0 z-30 backdrop-blur flex-shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
              <Scale className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
                MAJORSLAW<span className="text-amber-400">.ai</span>
              </span>
              <span className="hidden sm:inline text-slate-600 mx-2">|</span>
              <span className="hidden sm:inline text-slate-500 text-xs font-medium uppercase tracking-wide">Firm Calendar</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Upcoming appointments */}
            <button
              onClick={() => setShowUpcoming(true)}
              className="relative flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upcoming</span>
              {events.filter(e => new Date(e.start_time) > new Date() && e.status !== "cancelled").length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {Math.min(events.filter(e => new Date(e.start_time) > new Date() && e.status !== "cancelled").length, 99)}
                </span>
              )}
            </button>

            {/* Attorney Availability */}
            <button
              onClick={() => setShowAvailModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Availability</span>
            </button>

            {/* Sick button */}
            <button
              onClick={() => setShowSickModal(true)}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Thermometer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">I'm Sick Today</span>
            </button>

            {/* PTO button */}
            <button
              onClick={() => setShowPtoPanel(true)}
              className="relative flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PTO</span>
              {ptoPending > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center">{ptoPending}</span>
              )}
            </button>

            {/* New event */}
            <button
              onClick={() => setNewEventDate(new Date())}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-lg shadow-amber-400/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Event</span>
            </button>
          </div>
        </div>

        {/* ── Department Tabs ── */}
        <div className="px-4 sm:px-6 border-t border-slate-800/40 flex items-center gap-0.5 overflow-x-auto">
          {(Object.keys(DEPT_CONFIG) as Department[]).map(d => (
            <button
              key={d}
              onClick={() => setDepartment(d)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
                department === d
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {DEPT_CONFIG[d].icon}
              {DEPT_CONFIG[d].label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Sick Status Banner ── */}
      <SickStatusBanner staff={staff} events={filteredEvents} onRefresh={() => {
        api.get("calendar_events?order=start_time.asc&limit=500").then(evs => setEvents(evs ?? []));
      }} />

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-56 bg-[#0d1221] border-r border-slate-800 flex-shrink-0 overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Calendars filter */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Calendars</p>
              <div className="space-y-1">
                {(Object.keys(CAL_CONFIG) as CalendarType[]).map(t => {
                  const cfg = CAL_CONFIG[t];
                  const on  = selectedCals.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleCal(t)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${on ? "bg-slate-800/80" : "opacity-40 hover:opacity-70"}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: on ? cfg.color : "#475569" }} />
                      <span className={on ? "text-slate-200" : "text-slate-500"}>{cfg.label}</span>
                      {t === "court_deadline" && <span className="ml-auto text-[9px] text-orange-400/70 border border-orange-500/20 px-1 rounded">DL</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Staff filter */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Staff View</p>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedStaff("all")}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${selectedStaff === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
                >
                  <Users className="w-3 h-3" /> All Staff
                </button>
                {staff.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaff(s.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${selectedStaff === s.id ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="truncate">{s.name}</span>
                    {s.role === "attorney" && availabilities.find(a => a.staff_id === s.id) && (
                      <span className="ml-auto">
                        <Shield className="w-2.5 h-2.5 text-amber-400/60" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Today's summary */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Today</p>
              {todayEvs.length === 0 ? (
                <p className="text-xs text-slate-700">No events today.</p>
              ) : (
                <div className="space-y-1.5">
                  {todayEvs.slice(0,5).map(e => (
                    <button key={e.id} onClick={() => setSelectedEvent(e)} className="w-full text-left group">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CAL_CONFIG[e.calendar_type].color }} />
                        <p className="text-[10px] text-slate-400 group-hover:text-white transition-colors truncate leading-snug">{e.title}</p>
                      </div>
                      {!e.all_day && <p className="text-[9px] text-slate-700 pl-3">{fmtTime(e.start_time)}</p>}
                    </button>
                  ))}
                  {todayEvs.length > 5 && <p className="text-[9px] text-slate-700 pl-3">+{todayEvs.length - 5} more</p>}
                </div>
              )}
            </div>

            {/* PTO approved */}
            {ptoApproved.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Approved PTO</p>
                <div className="space-y-1.5">
                  {ptoApproved.slice(0,4).map(p => {
                    const s = staff.find(m => m.id === p.staff_id);
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s?.color ?? "#64748b" }} />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 truncate">{s?.name}</p>
                          <p className="text-[9px] text-slate-700">{p.start_date} – {p.end_date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main calendar area ── */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">

          {/* Calendar toolbar */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentDate(new Date())} className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all border border-slate-700">Today</button>
              <button onClick={() => navigate(-1)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => navigate(1)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-bold text-white ml-1">{headerLabel()}</h2>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {(["day","week","two_weeks","month","year"] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                    viewMode === v ? "bg-amber-400 text-slate-950 shadow" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-3 text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading calendar…</span>
              </div>
            </div>
          ) : (
            <>
              {viewMode === "month" && (
                <MonthGrid
                  year={year} month={month}
                  events={filteredEvents} ptoApproved={ptoApproved}
                  staff={staff} selectedCals={selectedCals}
                  onDayClick={d => { setCurrentDate(d); setViewMode("day"); }}
                  onEventClick={e => setSelectedEvent(e)}
                />
              )}
              {viewMode === "week" && (
                <WeekView
                  weekStart={weekStart} events={filteredEvents} selectedCals={selectedCals}
                  onEventClick={e => setSelectedEvent(e)}
                  onSlotClick={d => setNewEventDate(d)}
                />
              )}
              {viewMode === "two_weeks" && (
                <TwoWeekView
                  weekStart={weekStart} events={filteredEvents} selectedCals={selectedCals}
                  onEventClick={e => setSelectedEvent(e)}
                  onSlotClick={d => setNewEventDate(d)}
                />
              )}
              {viewMode === "day" && (
                <DayView
                  day={currentDate} events={filteredEvents} staff={staff} selectedCals={selectedCals}
                  onEventClick={e => setSelectedEvent(e)}
                  onSlotClick={d => setNewEventDate(d)}
                />
              )}
              {viewMode === "year" && (
                <YearView
                  year={year} events={filteredEvents} selectedCals={selectedCals}
                  onMonthClick={m => { const d = new Date(year, m, 1); setCurrentDate(d); setViewMode("month"); }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent} staff={staff} onClose={() => setSelectedEvent(null)}
          onUpdate={handleEventUpdate}
          onReassign={e => { setReassignEvent(e); setSelectedEvent(null); }}
        />
      )}
      {newEventDate && (
        <NewEventModal
          defaultDate={newEventDate} staff={staff} availabilities={availabilities}
          onClose={() => setNewEventDate(null)}
          onSave={e => { setEvents(prev => [...prev, e]); }}
        />
      )}
      {showPtoPanel && (
        <PtoPanelModal
          ptoList={ptoList} staff={staff}
          onClose={() => setShowPtoPanel(false)}
          onApprove={handlePtoApprove} onDeny={handlePtoDeny}
          onNewRequest={() => { setShowPtoPanel(false); setShowPtoForm(true); }}
        />
      )}
      {showPtoForm && (
        <PtoModal
          staff={staff} currentStaffId={staff[0]?.id ?? ""}
          onClose={() => setShowPtoForm(false)}
          onSaved={() => api.get("pto_requests?order=created_at.desc").then(r => r && setPtoList(r))}
        />
      )}
      {showSickModal && (
        <SickModal
          staff={staff} onClose={() => setShowSickModal(false)}
          onSaved={() => {}}
        />
      )}
      {showAvailModal && (
        <AttorneyAvailabilityModal
          staff={staff} availabilities={availabilities}
          onClose={() => setShowAvailModal(false)}
          onSaved={setAvailabilities}
        />
      )}
      {reassignEvent && (
        <ReassignModal
          event={reassignEvent} staff={staff}
          onClose={() => setReassignEvent(null)}
          onSaved={() => setReassignEvent(null)}
        />
      )}
      {showUpcoming && (
        <UpcomingPanel
          events={filteredEvents} staff={staff}
          onEventClick={e => setSelectedEvent(e)}
          onClose={() => setShowUpcoming(false)}
        />
      )}
    </div>
  );
}
