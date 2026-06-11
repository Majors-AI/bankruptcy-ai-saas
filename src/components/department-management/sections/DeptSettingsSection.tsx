// Department settings — hours, response templates, knowledge base, supervisor.
//
// Knowledge-base authorized-for-AI toggle is the gate that decides whether
// the firm's AI drafting endpoint (Anthropic API — TODO) may source from a
// document. Persistence + embedding store + retrieval guard are all TODO.

import { useState } from "react";
import { Clock, MessageSquare, BookOpen, Crown, Plus, X, Check } from "lucide-react";
import { useDepartmentStore } from "../store";
import { titleLabel } from "../seedData";
import type {
  Department, DayKey, TemplateChannel, ViewerRole,
} from "../types";

interface Props { department: Department; viewerRole: ViewerRole; viewerDepartmentId?: string | null; }

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export default function DeptSettingsSection({ department, viewerRole }: Props) {
  const store = useDepartmentStore();
  const canEdit =
    viewerRole === "law_firm_owner"
    || viewerRole === "super_admin"
    || (viewerRole === "department_supervisor"
        && department.supervisorId
        && store.actor.id === department.supervisorId);

  const templates = store.templates.filter(t => t.departmentId === department.id);
  const kbDocs = store.kbDocs.filter(d => d.departmentId === department.id);

  return (
    <div className="space-y-5">
      {/* ── Supervisor assignment ───────────────────────────────────────── */}
      <section className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-3.5 h-3.5 text-amber-300" />
          <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">Supervisor</p>
        </div>
        <select
          value={department.supervisorId ?? ""}
          disabled={!canEdit}
          onChange={e => store.setDepartmentSupervisor(department.id, e.target.value || null)}
          className="w-full max-w-md bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 disabled:opacity-60"
        >
          <option value="">— none —</option>
          {store.staff
            .filter(s => s.departmentIds.includes(department.id))
            .map(s => <option key={s.id} value={s.id}>{s.name} · {titleLabel(s.title)}</option>)}
        </select>
        <p className="text-[10px] text-[#6B6B66] mt-2 italic leading-snug">
          Supervisors unlock the Staff Settings + Reporting surface for their own department
          (scoped read/write); super admins + the firm owner see all departments.
        </p>
      </section>

      {/* ── Hours of operation ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">Hours of operation</p>
        </div>
        <div className="space-y-1.5">
          {DAYS.map(d => {
            const h = department.hours[d.key];
            return (
              <div key={d.key} className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-[#FAFAF7] w-12">{d.label}</span>
                <label className="flex items-center gap-1 text-[10px] text-[#6B6B66]">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={!h.closed}
                    onChange={e => store.setDepartmentHours(department.id, { ...department.hours, [d.key]: { ...h, closed: !e.target.checked } })}
                  />
                  Open
                </label>
                <input
                  type="time"
                  value={h.open}
                  disabled={!canEdit || h.closed}
                  onChange={e => store.setDepartmentHours(department.id, { ...department.hours, [d.key]: { ...h, open: e.target.value } })}
                  className="bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1 disabled:opacity-50"
                />
                <span className="text-[10px] text-[#6B6B66]">–</span>
                <input
                  type="time"
                  value={h.close}
                  disabled={!canEdit || h.closed}
                  onChange={e => store.setDepartmentHours(department.id, { ...department.hours, [d.key]: { ...h, close: e.target.value } })}
                  className="bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1 disabled:opacity-50"
                />
                {h.closed && <span className="text-[10px] text-rose-300 font-semibold">CLOSED</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Response templates ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
            <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">Response templates</p>
          </div>
        </div>
        <TemplateEditor department={department} canEdit={!!canEdit} />
        <ul className="space-y-2 mt-2">
          {templates.length === 0 && <li className="text-[11px] text-[#6B6B66] italic">No templates.</li>}
          {templates.map(t => (
            <li key={t.id} className="rounded border border-[#2A2A28] bg-[#1A1A18] p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <span className="text-[11px] font-semibold text-[#FAFAF7]">{t.label}</span>
                <div className="flex items-center gap-1">
                  {t.channels.map(c => (
                    <span key={c} className="text-[9px] uppercase tracking-widest text-amber-200 border border-amber-700/40 px-1.5 py-0.5 rounded">
                      {c}
                    </span>
                  ))}
                  {canEdit && (
                    <button
                      onClick={() => store.removeTemplate(t.id)}
                      title="Remove"
                      className="text-[#6B6B66] hover:text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <textarea
                readOnly={!canEdit}
                value={t.body}
                onChange={e => store.updateTemplate(t.id, { body: e.target.value })}
                rows={2}
                className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5 resize-y disabled:opacity-60 read-only:opacity-90"
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Knowledge base ──────────────────────────────────────────────── */}
      <section className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-3.5 h-3.5 text-amber-300" />
          <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">Knowledge base</p>
        </div>
        <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
          Firm-authorized content the AI sources for this department's client-facing answers.
          {/* TODO Phase B — Anthropic API draft endpoint reads ONLY chunks whose
              authorizedForAi=true; embedding store + retrieval gate ship with
              firm_kb_documents persistence. */}
        </p>
        <KbAdder department={department} canEdit={!!canEdit} />
        <ul className="space-y-1.5 mt-2">
          {kbDocs.length === 0 && <li className="text-[11px] text-[#6B6B66] italic">No knowledge-base documents.</li>}
          {kbDocs.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#FAFAF7] truncate">{d.title}</p>
                <p className="text-[10px] text-[#6B6B66]">{new Date(d.uploadedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={!canEdit}
                  onClick={() => store.toggleKbAuthorized(d.id)}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                    d.authorizedForAi
                      ? "border-emerald-700/50 text-emerald-200 bg-emerald-900/30"
                      : "border-[#2A2A28] text-[#6B6B66]"
                  } disabled:opacity-60`}
                >
                  {d.authorizedForAi && <Check className="w-3 h-3" />}
                  {d.authorizedForAi ? "Authorized" : "Not authorized"}
                </button>
                {canEdit && (
                  <button onClick={() => store.removeKbDoc(d.id)} className="text-[#6B6B66] hover:text-rose-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TemplateEditor({ department, canEdit }: { department: Department; canEdit: boolean }) {
  const store = useDepartmentStore();
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<TemplateChannel[]>(["email"]);

  function toggleChannel(c: TemplateChannel) {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function save() {
    if (!label.trim() || !body.trim() || channels.length === 0) return;
    store.addTemplate({ departmentId: department.id, label: label.trim(), body: body.trim(), channels });
    setLabel(""); setBody(""); setChannels(["email"]);
  }

  if (!canEdit) return null;

  return (
    <div className="mb-3 rounded border border-dashed border-[#2A2A28] p-2.5 space-y-2">
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Template name (e.g. Custom — payment reminder)"
        className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={2}
        placeholder="Body — use {first_name} etc. for interpolation"
        className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
      />
      <div className="flex items-center gap-2">
        {(["sms", "email"] as TemplateChannel[]).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => toggleChannel(c)}
            className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded border ${
              channels.includes(c) ? "border-amber-700 bg-amber-700/40 text-amber-100" : "border-[#2A2A28] text-[#6B6B66]"
            }`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={save}
          className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded border border-amber-700 bg-amber-700/40 text-amber-100 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add template
        </button>
      </div>
    </div>
  );
}

function KbAdder({ department, canEdit }: { department: Department; canEdit: boolean }) {
  const store = useDepartmentStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorized, setAuthorized] = useState(true);

  function save() {
    if (!title.trim()) return;
    store.addKbDoc({ departmentId: department.id, title: title.trim(), body: body.trim() || undefined, authorizedForAi: authorized });
    setTitle(""); setBody(""); setAuthorized(true);
  }

  if (!canEdit) return null;

  return (
    <div className="mb-3 rounded border border-dashed border-[#2A2A28] p-2.5 space-y-2">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Document title (e.g. 'Firm bio', 'Intake FAQ')"
        className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        placeholder="Body (markdown). Upload (PDF) wiring lands with persistence."
        className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-[10px] text-[#6B6B66]">
          <input
            type="checkbox"
            checked={authorized}
            onChange={e => setAuthorized(e.target.checked)}
          />
          Authorized for AI use (required to be sourced)
        </label>
        <button
          onClick={save}
          className="text-[11px] font-semibold px-2.5 py-1 rounded border border-amber-700 bg-amber-700/40 text-amber-100 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add document
        </button>
      </div>
    </div>
  );
}
