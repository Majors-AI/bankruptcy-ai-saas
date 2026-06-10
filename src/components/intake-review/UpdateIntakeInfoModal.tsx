// Update Intake Information modal (scaffold).
//
// Edits SAFE lead/intake fields when something the client gave us changes
// (corrected phone number, new address, updated debt estimate, etc.).
// Scope is strictly the lead row + the staff-controlled intake metadata.
//
// EXCLUDED from this surface:
//   - The locked client questionnaire (BankruptcyIntake.jsx) — that's
//     the client's own data, edited only via re-running the guided intake
//     or the client portal questionnaire. NEVER edited from this modal.
//   - Anything that originated from an attorney (attorney_case_acceptances:
//     decision, fees, case_type, attorney notes). Those are gated behind
//     the attorney review surface and editable only by a lawyer.
//
// Save behavior (today): scaffold-only. No DB write. The save handler
// calls `onSavedScaffold(changes)` with a summary string describing what
// changed; the host appends a time-log entry. Live build adds the
// supabase.from('intake_leads').update(...) call.
//
// TODO Phase B — persistence + audit:
//   - sbPatch('intake_leads', leadId, changedFields) for the lead row
//   - the time-log entry created by the host gets a `payload_jsonb` with
//     the before/after diff so the audit trail is complete
//   - server-side validation: reject writes to attorney-only fields here
//     (defense-in-depth in case the UI gate is bypassed)

import { useState } from "react";
import { X, Save, PenLine, AlertCircle } from "lucide-react";

// ─── Editable lead/intake fields ─────────────────────────────────────────────
// Strict allowlist — NOT the locked questionnaire and NOT attorney-originated.
// Add fields here only when you've confirmed they're staff-editable.
const EDITABLE_FIELDS = [
  { key: 'full_name',         label: 'Full name',           type: 'text'   as const, placeholder: 'First Last' },
  { key: 'email',             label: 'Email',               type: 'email'  as const, placeholder: 'name@example.com' },
  { key: 'phone',             label: 'Phone',               type: 'tel'    as const, placeholder: '(555) 555-0100' },
  { key: 'state',             label: 'State',               type: 'text'   as const, placeholder: 'AZ' },
  { key: 'preferred_contact', label: 'Preferred contact',   type: 'select' as const,
    options: [
      { value: 'phone', label: 'Phone' },
      { value: 'email', label: 'Email' },
      { value: 'text',  label: 'Text (SMS)' },
    ] },
  { key: 'urgency',           label: 'Urgency',             type: 'select' as const,
    options: [
      { value: 'normal',     label: 'Normal' },
      { value: 'urgent',     label: 'Urgent' },
      { value: 'emergency',  label: 'Emergency' },
    ] },
  { key: 'chapter_interest',  label: 'Chapter interest',    type: 'select' as const,
    options: [
      { value: '7',  label: 'Chapter 7' },
      { value: '13', label: 'Chapter 13' },
      { value: '',   label: '— unspecified —' },
    ] },
  { key: 'debt_estimate',     label: 'Est. total debt',     type: 'number' as const, placeholder: '0' },
  { key: 'income_estimate',   label: 'Est. monthly income', type: 'number' as const, placeholder: '0' },
  { key: 'source',            label: 'Lead source',         type: 'text'   as const, placeholder: 'inbound, referral, ad, …' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export interface IntakeEditableValues {
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  preferred_contact?: string | null;
  urgency?: string | null;
  chapter_interest?: number | null;
  debt_estimate?: number | null;
  income_estimate?: number | null;
  source?: string | null;
}

interface UpdateIntakeInfoModalProps {
  lead: IntakeEditableValues & { id: string };
  /** Called when the staffer presses Save. The host should append a time-log
   *  entry summarizing the changes. NO real DB write happens in the scaffold;
   *  the host's TODO converts this into a sbPatch + time-log RPC call. */
  onSavedScaffold: (summary: string, changedFields: Record<string, unknown>) => void;
  onClose: () => void;
  /** Lock the form for non-attorney edits to attorney-originated fields. The
   *  default allowlist already excludes those, so canEdit just disables Save. */
  canEdit?: boolean;
}

function toNumberOrNull(v: string): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fieldValueAsString(lead: IntakeEditableValues, key: string): string {
  const raw = (lead as Record<string, unknown>)[key];
  if (raw == null) return '';
  return String(raw);
}

export default function UpdateIntakeInfoModal({
  lead, onSavedScaffold, onClose, canEdit = true,
}: UpdateIntakeInfoModalProps) {
  // Initialize draft from the lead's current values; we'll diff on save.
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    EDITABLE_FIELDS.forEach(f => { out[f.key] = fieldValueAsString(lead, f.key); });
    return out;
  });
  const [saving, setSaving] = useState(false);

  function setField(key: string, val: string) {
    setDraft(prev => ({ ...prev, [key]: val }));
  }

  function diff(): { changedFields: Record<string, unknown>; summary: string } {
    const changed: Record<string, unknown> = {};
    const lines: string[] = [];
    EDITABLE_FIELDS.forEach(f => {
      const orig = fieldValueAsString(lead, f.key);
      const next = draft[f.key] ?? '';
      if (orig === next) return;
      let value: unknown = next;
      if (f.type === 'number') {
        value = toNumberOrNull(next);
      } else if (next === '') {
        value = null;
      }
      changed[f.key] = value;
      const display = next === '' ? '—' : next;
      const before = orig === '' ? '—' : orig;
      lines.push(`${f.label}: ${before} → ${display}`);
    });
    return { changedFields: changed, summary: lines.join('\n') };
  }

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    const { changedFields, summary } = diff();
    if (Object.keys(changedFields).length === 0) {
      // Nothing to save — close without writing a no-op log entry.
      setSaving(false);
      onClose();
      return;
    }
    // TODO Phase B — real persistence:
    //   await sbPatch('intake_leads', lead.id, changedFields);
    // and only on success call onSavedScaffold + onClose.
    onSavedScaffold(summary, changedFields);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Update intake information</p>
          <button
            onClick={onClose}
            className="ml-auto text-slate-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope disclaimer */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/40 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Edits the lead/intake metadata only. The locked client questionnaire is NOT
            editable here, and attorney-originated content (decision, fees, case type) is
            excluded — those changes happen on the attorney review surface.
          </p>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {EDITABLE_FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                {f.label}
              </span>
              {f.type === 'select' ? (
                <select
                  value={draft[f.key] ?? ''}
                  onChange={e => setField(f.key, e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[12px] rounded px-2 py-1.5 focus:outline-none focus:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">— select —</option>
                  {f.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  value={draft[f.key] ?? ''}
                  onChange={e => setField(f.key, e.target.value)}
                  disabled={!canEdit}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[12px] rounded px-2 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              )}
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
          <p className="text-[10px] text-slate-500 italic">
            Save writes a time-log entry. Scaffold today — no DB write yet.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canEdit || saving}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 rounded px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3 h-3" /> {saving ? 'Saving…' : 'Save changes (scaffold)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
