// Calendar Configuration page (left-nav, under Law Firm Settings).
//
// Per-firm calendar config — which department calendars exist, what
// appointment types each one offers (with colors), and per-department
// behavior flags (supervisor reassignment, sick auto-reschedule, task-
// list feed). Court Calendar is special — it splits per admitted state
// (chips render below the section header).
//
// Read by FirmCalendar to drive its department filter strip + the
// New Event appointment-type dropdown.
//
// Edit gate: same canAdjustLivingStandards rule as the rest of Law Firm
// Settings (attorney_super_admin OR law_firm_owner). Others see a
// read-only render with disabled inputs.

import { useMemo, useState } from "react";
import {
  CalendarDays, Plus, X, RefreshCcw, MapPin, Briefcase, Scale,
  Users, FileText, Phone, Lock, UserCog, Heart, ListTodo, Info, UserCircle2,
} from "lucide-react";
import {
  getFirmCalendarConfigDefault, setFirmCalendarConfig,
  setDepartmentAppointmentTypes, setDepartmentFlags,
  buildAppointmentTypeFromLabel,
  useFirmCalendarConfig,
  useFirmAdmittedStates,
  type CalendarDepartmentId, type CalendarDepartmentConfig,
} from "../../lib/firmPolicy";
import { canAdjustLivingStandards } from "./livingStandardsOverlay";
import type { LegalReferenceViewerRole } from "../legal-reference/LegalReferenceStore";

interface Props {
  legalReferenceRole?: LegalReferenceViewerRole;
}

const DEPT_ICON: Record<CalendarDepartmentId, React.FC<{ className?: string }>> = {
  intake:           Users,
  accounting:       Briefcase,
  client_relations: Phone,
  court:            Scale,
  legal:            FileText,
};

// Default color used when the user adds a new appointment type. Firm
// supervisors can change it inline via the swatch picker.
const NEW_TYPE_DEFAULT_COLOR = "#64748b"; // slate-500

export default function CalendarConfigurationPage({ legalReferenceRole = "none" }: Props) {
  const cfg = useFirmCalendarConfig();
  const canEdit = canAdjustLivingStandards(legalReferenceRole);
  const admittedStates = useFirmAdmittedStates();

  function resetAll() {
    setFirmCalendarConfig(getFirmCalendarConfigDefault());
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1A1A18] border border-[#2A2A28] flex items-center justify-center"
             style={{ color: "var(--lfs-accent)" }}>
          <CalendarDays className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-[#FAFAF7]">Calendar Configuration</h2>
          <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
            Department calendars, appointment types (with colors), and per-department behavior.
            Drives the firm calendar's department filter strip, location filter (admitted-states),
            and the New Event appointment-type dropdown. Court Calendar splits per admitted state
            — managed in <strong className="text-[#FAFAF7]">Firm Policy → Practice Jurisdictions</strong>.
          </p>
        </div>
        {!canEdit && (
          <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Read-only
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] rounded px-2.5 py-1.5 hover:text-white"
          >
            <RefreshCcw className="w-3 h-3" /> Reset all to defaults
          </button>
        )}
      </div>

      {/* Locations overview — derived from admitted states (read-only) */}
      <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-sm font-bold text-[#FAFAF7]">Locations</p>
          <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-0.5">
            {admittedStates.length} location{admittedStates.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-2.5">
          Calendar locations mirror the firm's admitted-practice jurisdictions. Staff can filter
          to one location or view multiple simultaneously from the calendar sidebar.
        </p>
        {admittedStates.length === 0 ? (
          <p className="text-[11px] text-amber-300 italic">
            No locations — add jurisdictions in Firm Policy → Practice Jurisdictions.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {admittedStates.map(s => (
              <span
                key={s}
                className="inline-flex items-center gap-1 text-[11px] font-semibold border border-amber-500/30 text-amber-300 bg-amber-500/5 rounded-full px-2.5 py-1"
              >
                <MapPin className="w-3 h-3" />{s}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Per-department editors */}
      {cfg.departments.map(dept => (
        <DepartmentEditor
          key={dept.id}
          dept={dept}
          canEdit={canEdit}
          admittedStates={admittedStates}
        />
      ))}

      {/* Wiring notice — flag the follow-ups so they don't surprise anyone */}
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-200 leading-relaxed space-y-1.5">
            <p><strong className="text-amber-300">Wired today:</strong> per-department defaults, appointment-type list + colors, location chips, supervisor / sick / task-list toggles persist + render on the calendar sidebar.</p>
            <p><strong className="text-amber-300">Follow-up wiring (scaffold-only here):</strong></p>
            <ul className="list-disc list-inside space-y-0.5 pl-2">
              <li>Event filtering by event.department + location (events need department + location tags first).</li>
              <li>Supervisor reassignment + sick auto-reschedule mechanics.</li>
              <li>Task-list feed: upcoming appointments auto-populating each staff member's task list.</li>
              <li>ECF notice ingestion into the Court Calendar (hearings + Ch.13 deadlines).</li>
              <li>Mirror in the per-department portal's Settings sub-tab.</li>
            </ul>
          </div>
        </div>
      </section>

      <p className="text-[10px] text-[#6B6B66] italic leading-snug">
        {/* TODO Phase B — firm_calendar_config(firm_id, departments_jsonb,
              set_by_user_id, set_at). Audit each save. */}
        Today the config lives in memory + per-tab localStorage. Server persistence + audit
        land with the firm_calendar_config table.
      </p>
    </div>
  );
}

// ─── Per-department editor ────────────────────────────────────────────────

function DepartmentEditor({
  dept, canEdit, admittedStates,
}: {
  dept: CalendarDepartmentConfig;
  canEdit: boolean;
  admittedStates: ReadonlyArray<string>;
}) {
  const Icon = DEPT_ICON[dept.id];
  const [draft, setDraft] = useState<string>("");
  const [draftColor, setDraftColor] = useState<string>(NEW_TYPE_DEFAULT_COLOR);

  function addType() {
    const next = draft.trim();
    if (!next) return;
    const newType = buildAppointmentTypeFromLabel(next, draftColor);
    if (dept.appointmentTypes.some(t => t.id === newType.id)) {
      setDraft("");
      return;
    }
    setDepartmentAppointmentTypes(dept.id, [...dept.appointmentTypes, newType]);
    setDraft("");
  }

  function removeType(id: string) {
    setDepartmentAppointmentTypes(dept.id, dept.appointmentTypes.filter(x => x.id !== id));
  }

  function setTypeColor(id: string, color: string) {
    setDepartmentAppointmentTypes(
      dept.id,
      dept.appointmentTypes.map(x => x.id === id ? { ...x, color } : x),
    );
  }

  function resetTypes() {
    const def = getFirmCalendarConfigDefault();
    const fallback = def.departments.find(d => d.id === dept.id)?.appointmentTypes ?? [];
    setDepartmentAppointmentTypes(dept.id, fallback);
  }

  const stateChips = useMemo(() => {
    if (!dept.splitByAdmittedState) return null;
    if (admittedStates.length === 0) {
      return (
        <p className="text-[11px] text-amber-300 italic">
          No admitted states configured — Court Calendar will appear without per-state split.
          Add states in <strong>Firm Policy → Practice Jurisdictions</strong>.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {admittedStates.map(s => (
          <span
            key={s}
            className="inline-flex items-center gap-1 text-[10px] font-semibold border border-amber-500/30 text-amber-300 bg-amber-500/5 rounded-full px-2 py-0.5"
          >
            <MapPin className="w-2.5 h-2.5" />
            {s}
          </span>
        ))}
      </div>
    );
  }, [dept.splitByAdmittedState, admittedStates]);

  return (
    <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
      <div className="flex items-start gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2" style={{ color: "var(--lfs-accent)" }}>
          <Icon className="w-4 h-4" />
          <p className="text-sm font-bold text-[#FAFAF7]">{dept.label}</p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] rounded-full px-2 py-0.5">
          {dept.appointmentTypes.length} appointment type{dept.appointmentTypes.length === 1 ? "" : "s"}
        </span>
        {dept.splitByAdmittedState && (
          <span className="text-[10px] uppercase tracking-widest border rounded-full px-2 py-0.5 border-amber-500/30 text-amber-300 bg-amber-500/5">
            split by state
          </span>
        )}
      </div>

      {/* Per-state chips for Court */}
      {stateChips && <div className="mb-3">{stateChips}</div>}

      {/* Behavior toggles — supervisor reassignment, sick auto-reschedule,
          task-list feed, allow-additional. These are scaffold today —
          wiring lands in a follow-up. */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FlagToggle
          icon={<UserCog className="w-3.5 h-3.5" />}
          label="Supervisor reassign"
          desc="Department supervisors / super-admins may reassign on request."
          checked={dept.supervisorReassignEnabled === true}
          disabled={!canEdit}
          onChange={v => setDepartmentFlags(dept.id, { supervisorReassignEnabled: v })}
        />
        <FlagToggle
          icon={<Heart className="w-3.5 h-3.5" />}
          label="Sick auto-reschedule"
          desc="Staff sick-out triggers automatic reshuffling per dept rules."
          checked={dept.sickAutoRescheduleEnabled === true}
          disabled={!canEdit}
          onChange={v => setDepartmentFlags(dept.id, { sickAutoRescheduleEnabled: v })}
        />
        <FlagToggle
          icon={<ListTodo className="w-3.5 h-3.5" />}
          label="Task-list feed"
          desc="Upcoming appointments populate each assignee's My Tasks."
          checked={dept.taskListFeedEnabled !== false}
          disabled={!canEdit}
          onChange={v => setDepartmentFlags(dept.id, { taskListFeedEnabled: v })}
        />
        <FlagToggle
          icon={<Plus className="w-3.5 h-3.5" />}
          label="Allow additional types"
          desc="Staff in this department may add appointment types on the fly."
          checked={dept.allowAdditionalTypes !== false}
          disabled={!canEdit}
          onChange={v => setDepartmentFlags(dept.id, { allowAdditionalTypes: v })}
        />
      </div>

      {/* Appointment-type list */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5">
        Appointment types
      </p>
      <ul className="flex flex-wrap gap-1.5 mb-3">
        {dept.appointmentTypes.length === 0 && (
          <li className="text-[11px] text-[#6B6B66] italic">No appointment types yet — add below.</li>
        )}
        {dept.appointmentTypes.map(t => (
          <li
            key={t.id}
            className="inline-flex items-center gap-1.5 text-[11px] border border-[#2A2A28] bg-[#0F0F0E] text-[#FAFAF7] rounded-full pl-1.5 pr-2.5 py-1"
          >
            <label
              className="inline-block w-4 h-4 rounded-full border border-slate-600 flex-shrink-0 cursor-pointer relative overflow-hidden"
              style={{ background: t.color }}
              title={canEdit ? `Click to change color (current ${t.color})` : `Color ${t.color}`}
            >
              {canEdit && (
                <input
                  type="color"
                  value={t.color}
                  onChange={e => setTypeColor(t.id, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              )}
            </label>
            <span>{t.label}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => removeType(t.id)}
                className="text-[#6B6B66] hover:text-rose-300"
                title={`Remove "${t.label}"`}
                aria-label={`Remove ${t.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Add new appointment-type */}
      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="relative inline-block w-7 h-7 rounded-md border border-[#2A2A28] cursor-pointer overflow-hidden flex-shrink-0"
                 style={{ background: draftColor }}
                 title={`New-type color (${draftColor})`}>
            <input
              type="color"
              value={draftColor}
              onChange={e => setDraftColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addType(); } }}
            placeholder="Add appointment type (label)"
            className="bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 w-64"
          />
          <button
            type="button"
            onClick={addType}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
          >
            <Plus className="w-3 h-3" /> Add
          </button>
          <button
            type="button"
            onClick={resetTypes}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] rounded px-2.5 py-1.5 hover:text-white"
            title="Reset this department's appointment types to defaults"
          >
            <RefreshCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      )}

      {/* Individual staff calendars sub-section (scaffold) */}
      <div className="mt-4 pt-4 border-t border-[#2A2A28]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1.5 flex items-center gap-1.5">
          <UserCircle2 className="w-3 h-3" /> Individual staff calendars
        </p>
        <p className="text-[10px] text-[#6B6B66] italic leading-snug">
          Each staff member assigned to <strong className="text-[#FAFAF7]">{dept.label}</strong> automatically
          gets a personal sub-calendar that inherits these appointment types + flags.
          {/* TODO: wire from departments roster (existing department-management
              store) so the sub-list renders here under each dept editor. */}
        </p>
      </div>
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function FlagToggle({
  icon, label, desc, checked, disabled, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-2 rounded border px-2.5 py-2 text-[11px] ${
      checked ? "border-emerald-700/40 bg-emerald-900/10" : "border-[#2A2A28] bg-[#0F0F0E]"
    } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="accent-emerald-500 mt-0.5"
      />
      <div className="min-w-0">
        <p className="font-semibold text-[#FAFAF7] flex items-center gap-1.5">
          {icon}{label}
        </p>
        <p className="text-[10px] text-[#6B6B66] leading-snug">{desc}</p>
      </div>
    </label>
  );
}
