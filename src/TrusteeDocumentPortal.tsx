import { useState, useEffect, useCallback } from 'react';
import { Scale, ChevronRight, ChevronDown, Plus, Trash2, CreditCard as Edit2, Save, X, Check, Clock, AlertCircle, Upload, FileText, User, Building2, Phone, Mail, MapPin, Search, RefreshCw, CheckCircle2, Circle, FolderOpen, Tag, List, ExternalLink, Send, Bell, BellOff, History, Calendar, Hash, ClipboardList, Download } from 'lucide-react';
import FirmTrusteesPanel from './admin/FirmTrusteesPanel';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// V1 pilot: both MLG and Neeley share this default; replace with auth.firm_id once multi-tenant auth lands
const V1_DEFAULT_FIRM_ID = '00000000-0000-0000-0000-000000000001';

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function sbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  return r.ok ? r.json() : [];
}
async function sbPost<T>(table: string, body: object): Promise<T | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const data = await r.json();
  return r.ok ? (Array.isArray(data) ? data[0] : data) : null;
}
async function sbPatch(table: string, id: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
}
async function sbDelete(table: string, id: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE', headers,
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrusteeState {
  id: string;
  name: string;
  abbreviation: string;
  active: boolean;
}
interface ChapterType {
  id: string;
  name: string;
  code: string;
  description: string;
  sort_order: number;
}
interface Trustee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  state_id: string;
  chapter_type_id: string;
  district: string | null;
  notes: string | null;
  active: boolean;
}
interface DocCategory {
  id: string;
  name: string;
  description: string | null;
  chapter_type_id: string;
  sort_order: number;
}
interface DocRequirement {
  id: string;
  trustee_id: string;
  category_id: string | null;
  document_name: string;
  description: string | null;
  required: boolean;
  sort_order: number;
}
interface DocRequest {
  id: string;
  trustee_id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  case_number: string | null;
  status: string;
  due_date: string | null;
  hearing_date: string | null;
  hearing_341_date: string | null;
  doc_due_date: string | null;
  submitted_at: string | null;
  last_followup_at: string | null;
  last_followup_type: string | null;
  followup_count: number;
  auto_followup_enabled: boolean;
  paralegal_review_status: string | null;
  submitted_to_trustee_at: string | null;
  priority_level: string | null;
  last_auto_reminder_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
interface RequestItem {
  id: string;
  request_id: string;
  requirement_id: string | null;
  document_name: string;
  required: boolean;
  status: string;
  client_notes: string | null;
  staff_notes: string | null;
  uploaded_at: string | null;
  submitted_at: string | null;
}
interface FollowupLog {
  id: string;
  request_id: string;
  sent_at: string;
  followup_type: string;
  method: string;
  message: string | null;
  sent_by: string | null;
}
interface TrusteeApiConfig {
  id: string;
  trustee_id: string;
  portal_name: string;
  portal_url: string | null;
  api_type: string;
  api_endpoint: string | null;
  api_key_hint: string | null;
  submission_email: string | null;
  ecf_login: string | null;
  notes: string | null;
  enabled: boolean;
}
interface ParalegalReview {
  id: string;
  request_id: string;
  trustee_id: string;
  status: string;
  assigned_to: string | null;
  reviewed_by: string | null;
  review_started_at: string | null;
  review_completed_at: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
}
interface ParalegalReviewItem {
  id: string;
  review_id: string;
  request_item_id: string;
  document_name: string;
  status: string;
  paralegal_note: string | null;
  confirmed_at: string | null;
}
interface PortalSubmission {
  id: string;
  request_id: string;
  trustee_id: string;
  submitted_by: string | null;
  submitted_at: string;
  method: string;
  status: string;
  documents_included: string[] | null;
  notes: string | null;
}
interface ChecklistDefault {
  id: string;
  doc_type: string;
  display_label: string;
  description: string | null;
  required: boolean;
  applies_to: string | null;
  expected_count_min: number;
  category: string | null;
  sort_order: number;
}
interface FirmChecklistItem {
  id: string;
  firm_id: string;
  doc_type: string;
  display_label: string;
  description: string | null;
  required: boolean;
  applies_to: string | null;
  expected_count_min: number;
  expected_count_max: number | null;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  added_at: string;
}
interface ChecklistItemState {
  id: string;
  request_id: string;
  firm_id: string;
  doc_type: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}
// ─── Status helpers ───────────────────────────────────────────────────────────

const REQ_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  needed:     { label: 'Needed',     color: 'text-amber-400 bg-amber-900/30 border-amber-700/40',   icon: <Clock className="w-3 h-3" /> },
  pending:    { label: 'Needed',     color: 'text-amber-400 bg-amber-900/30 border-amber-700/40',   icon: <Clock className="w-3 h-3" /> },
  uploaded:   { label: 'Uploaded',   color: 'text-sky-400 bg-sky-900/30 border-sky-700/40',         icon: <Upload className="w-3 h-3" /> },
  approved:   { label: 'Approved',   color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:   { label: 'Rejected',   color: 'text-red-400 bg-red-900/30 border-red-700/40',         icon: <AlertCircle className="w-3 h-3" /> },
  waived:     { label: 'Waived',     color: 'text-slate-400 bg-slate-800/50 border-slate-600/40',   icon: <X className="w-3 h-3" /> },
};

const REQUEST_STATUS: Record<string, { label: string; color: string }> = {
  open:      { label: 'Open',       color: 'text-amber-400 bg-amber-900/30 border-amber-700/40' },
  in_review: { label: 'In Review',  color: 'text-sky-400 bg-sky-900/30 border-sky-700/40' },
  complete:  { label: 'Complete',   color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40' },
  closed:    { label: 'Closed',     color: 'text-slate-400 bg-slate-800/50 border-slate-600/40' },
};

const CHAPTER_COLORS: Record<string, string> = {
  ch7:  'text-sky-400 bg-sky-900/30 border-sky-700/40',
  ch11: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
  ch13: 'text-teal-400 bg-teal-900/30 border-teal-700/40',
};

const inp = 'w-full bg-slate-800/60 border border-slate-700/60 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors';
const lbl = 'text-xs font-semibold text-slate-400 mb-1.5 block';

// ─── Add/Edit Trustee Modal ───────────────────────────────────────────────────

function TrusteeModal({
  trustee, states, chapters, onSave, onClose,
}: {
  trustee: Partial<Trustee> | null;
  states: TrusteeState[];
  chapters: ChapterType[];
  onSave: (t: Trustee) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: trustee?.name ?? '',
    email: trustee?.email ?? '',
    phone: trustee?.phone ?? '',
    state_id: trustee?.state_id ?? '',
    chapter_type_id: trustee?.chapter_type_id ?? '',
    district: trustee?.district ?? '',
    notes: trustee?.notes ?? '',
    active: trustee?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isEdit = !!trustee?.id;

  async function handleSave() {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    if (!form.state_id) { setErr('State is required.'); return; }
    if (!form.chapter_type_id) { setErr('Chapter type is required.'); return; }
    setSaving(true);
    setErr('');
    const payload = {
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      state_id: form.state_id,
      chapter_type_id: form.chapter_type_id,
      district: form.district || null,
      notes: form.notes || null,
      active: form.active,
    };
    let result: Trustee | null = null;
    if (isEdit && trustee?.id) {
      await sbPatch('trustees', trustee.id, payload);
      result = { ...trustee, ...payload } as Trustee;
    } else {
      result = await sbPost<Trustee>('trustees', payload);
    }
    setSaving(false);
    if (result) onSave(result);
    else setErr('Failed to save. Please try again.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <User className="w-4 h-4 text-sky-400" />
            </div>
            <span className="text-sm font-semibold text-white">{isEdit ? 'Edit Trustee' : 'Add Trustee'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {err && <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className={lbl}>Full Name *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Doe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>State *</label>
              <select className={inp} value={form.state_id} onChange={e => setForm(f => ({ ...f, state_id: e.target.value }))}>
                <option value="">Select state…</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.name} ({s.abbreviation})</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Chapter Type *</label>
              <select className={inp} value={form.chapter_type_id} onChange={e => setForm(f => ({ ...f, chapter_type_id: e.target.value }))}>
                <option value="">Select chapter…</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>District</label>
            <input className={inp} value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="e.g. Central District of California" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Email</label>
              <input className={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="trustee@court.gov" />
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input className={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
            </div>
          </div>
          <div>
            <label className={lbl}>Internal Notes</label>
            <textarea className={`${inp} resize-none`} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes about this trustee's preferences, quirks, etc." />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className={`w-9 h-5 rounded-full transition-colors relative ${form.active ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-slate-400">Active</span>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Add Trustee'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Document Requirement Modal ──────────────────────────────────────────

function RequirementModal({
  trusteeId, categories, existing, onSave, onClose,
}: {
  trusteeId: string;
  categories: DocCategory[];
  existing?: DocRequirement;
  onSave: (r: DocRequirement) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    document_name: existing?.document_name ?? '',
    description: existing?.description ?? '',
    category_id: existing?.category_id ?? '',
    required: existing?.required ?? true,
    sort_order: existing?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    if (!form.document_name.trim()) { setErr('Document name is required.'); return; }
    setSaving(true);
    setErr('');
    const payload = {
      trustee_id: trusteeId,
      document_name: form.document_name.trim(),
      description: form.description || null,
      category_id: form.category_id || null,
      required: form.required,
      sort_order: form.sort_order,
    };
    let result: DocRequirement | null = null;
    if (existing?.id) {
      await sbPatch('trustee_document_requirements', existing.id, payload);
      result = { ...existing, ...payload };
    } else {
      result = await sbPost<DocRequirement>('trustee_document_requirements', payload);
    }
    setSaving(false);
    if (result) onSave(result);
    else setErr('Failed to save.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700/60 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
              <FileText className="w-4 h-4 text-teal-400" />
            </div>
            <span className="text-sm font-semibold text-white">{existing ? 'Edit Document' : 'Add Document Requirement'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className={lbl}>Document Name *</label>
            <input className={inp} value={form.document_name} onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))} placeholder="e.g. Last 2 Years Tax Returns" />
          </div>
          <div>
            <label className={lbl}>Category</label>
            <select className={inp} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional details for staff or client…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Sort Order</label>
              <input className={inp} type="number" min={0} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex flex-col justify-end pb-0.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setForm(f => ({ ...f, required: !f.required }))}
                  className={`w-9 h-5 rounded-full transition-colors relative ${form.required ? 'bg-red-500' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-slate-400">Required</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Client Request Modal ─────────────────────────────────────────────────

function NewRequestModal({
  trustee, requirements, onSave, onClose,
}: {
  trustee: Trustee;
  requirements: DocRequirement[];
  onSave: (req: DocRequest, items: RequestItem[]) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    client_name: '',
    client_id: '',
    case_number: '',
    due_date: '',
    hearing_date: '',
    notes: '',
    created_by: 'Staff',
  });
  const [selected, setSelected] = useState<Set<string>>(
    new Set(requirements.filter(r => r.required).map(r => r.id))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function toggleReq(id: string) {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function handleSave() {
    if (!form.client_name.trim()) { setErr('Client name is required.'); return; }
    if (selected.size === 0) { setErr('Select at least one document.'); return; }
    setSaving(true);
    setErr('');
    // auto-compute doc_due_date = hearing_date - 10 days
    let docDueDate: string | null = null;
    if (form.hearing_date) {
      const d = new Date(form.hearing_date);
      d.setDate(d.getDate() - 10);
      docDueDate = d.toISOString().split('T')[0];
    }
    const reqPayload = {
      trustee_id: trustee.id,
      client_id: form.client_id || `client-${Date.now()}`,
      client_name: form.client_name.trim(),
      case_number: form.case_number || null,
      status: 'open',
      due_date: form.due_date || docDueDate || null,
      hearing_date: form.hearing_date || null,
      hearing_341_date: form.hearing_date || null,
      doc_due_date: docDueDate,
      auto_followup_enabled: true,
      followup_count: 0,
      notes: form.notes || null,
      created_by: form.created_by,
    };
    const docRequest = await sbPost<DocRequest>('trustee_document_requests', reqPayload);
    if (!docRequest) { setSaving(false); setErr('Failed to create request.'); return; }
    const itemsPayload = [...selected].map(reqId => {
      const r = requirements.find(x => x.id === reqId)!;
      return {
        request_id: docRequest.id,
        requirement_id: reqId,
        document_name: r.document_name,
        required: r.required,
        status: 'needed',
      };
    });
    const items: RequestItem[] = [];
    for (const item of itemsPayload) {
      const created = await sbPost<RequestItem>('trustee_request_items', item);
      if (created) items.push(created);
    }
    setSaving(false);
    onSave(docRequest, items);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">New Document Request</p>
              <p className="text-xs text-slate-500">{trustee.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {err && <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Client Name *</label>
              <input className={inp} value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Full client name" />
            </div>
            <div>
              <label className={lbl}>Case Number</label>
              <input className={inp} value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))} placeholder="e.g. 2:24-bk-01234" />
            </div>
            <div>
              <label className={lbl}>Created By</label>
              <input className={inp} value={form.created_by} onChange={e => setForm(f => ({ ...f, created_by: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>341 Hearing Date</label>
              <input className={`${inp} [color-scheme:dark]`} type="date" value={form.hearing_date} onChange={e => setForm(f => ({ ...f, hearing_date: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Doc Due Date <span className="text-slate-600 font-normal">(auto: 10d before hearing)</span></label>
              <input className={`${inp} [color-scheme:dark]`} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Notes</label>
              <textarea className={`${inp} resize-none`} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Select Documents to Request</p>
            <div className="space-y-1.5">
              {requirements.sort((a, b) => a.sort_order - b.sort_order).map(req => (
                <button
                  key={req.id}
                  onClick={() => toggleReq(req.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    selected.has(req.id)
                      ? 'bg-sky-900/25 border-sky-700/50 text-white'
                      : 'bg-slate-800/30 border-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {selected.has(req.id)
                    ? <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    : <Circle className="w-4 h-4 flex-shrink-0" />}
                  <span className="text-sm flex-1">{req.document_name}</span>
                  {req.required && (
                    <span className="text-[10px] font-semibold text-red-400 bg-red-900/30 border border-red-700/40 rounded px-1.5 py-0.5">REQ</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trustee Detail Panel ─────────────────────────────────────────────────────

// ─── Follow-up Log Modal ──────────────────────────────────────────────────────

function FollowupLogModal({
  request, onClose,
}: {
  request: DocRequest;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<FollowupLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sbGet<FollowupLog>(`trustee_followup_log?request_id=eq.${request.id}&order=sent_at.desc`)
      .then(data => { setLogs(data); setLoading(false); });
  }, [request.id]);

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  const methodIcon: Record<string, React.ReactNode> = {
    email: <Mail className="w-3 h-3" />,
    phone: <Phone className="w-3 h-3" />,
    sms: <Send className="w-3 h-3" />,
    portal: <FileText className="w-3 h-3" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0d1221] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <History className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Follow-up History</p>
              <p className="text-xs text-slate-500">{request.client_name} — {request.case_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-20"><RefreshCw className="w-4 h-4 text-slate-600 animate-spin" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <History className="w-7 h-7 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No follow-ups sent yet.</p>
            </div>
          ) : logs.map(log => (
            <div key={log.id} className="flex gap-3 px-3 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                log.followup_type === 'auto'
                  ? 'bg-teal-900/40 border border-teal-700/40 text-teal-400'
                  : 'bg-amber-900/40 border border-amber-700/40 text-amber-400'
              }`}>
                {log.followup_type === 'auto' ? <Bell className="w-3 h-3" /> : <Send className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                    log.followup_type === 'auto'
                      ? 'text-teal-400 bg-teal-900/30 border-teal-700/40'
                      : 'text-amber-400 bg-amber-900/30 border-amber-700/40'
                  }`}>{log.followup_type === 'auto' ? 'Auto' : 'Manual'}</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    {methodIcon[log.method] ?? <Mail className="w-3 h-3" />}{log.method}
                  </span>
                  {log.sent_by && <span className="text-[11px] text-slate-600">by {log.sent_by}</span>}
                </div>
                {log.message && <p className="text-xs text-slate-300 leading-relaxed">{log.message}</p>}
                <p className="text-[11px] text-slate-600 mt-1">{fmtDate(log.sent_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 341 Checklist — per-request section shown inside expanded DocRequest ────

function RequestChecklistSection({
  req,
  firmId,
}: {
  req: DocRequest;
  firmId: string;
}) {
  const [checklistItems, setChecklistItems] = useState<FirmChecklistItem[]>([]);
  const [itemStates, setItemStates] = useState<ChecklistItemState[]>([]);
  const [clientDocs, setClientDocs] = useState<{ document_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!req.submitted_to_trustee_at);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      sbGet<FirmChecklistItem>(
        `firm_trustee_doc_checklist?firm_id=eq.${firmId}&is_active=eq.true&order=sort_order.asc`
      ),
      sbGet<ChecklistItemState>(
        `trustee_341_checklist_state?request_id=eq.${req.id}`
      ),
      sbGet<{ document_type: string }>(
        `client_documents?client_id=eq.${encodeURIComponent(req.client_id)}&phase=eq.07-trustee&select=document_type`
      ),
    ]).then(([items, states, docs]) => {
      setChecklistItems(items);
      setItemStates(states);
      setClientDocs(docs);
      setLoading(false);
    });
  }, [firmId, req.id, req.client_id]);

  function getItemStatus(item: FirmChecklistItem): 'complete' | 'partial' | 'missing' {
    const st = itemStates.find(s => s.doc_type === item.doc_type);
    if (st?.completed) return 'complete';
    const matching = clientDocs.filter(
      d => d.document_type === item.doc_type || d.document_type.startsWith(item.doc_type)
    );
    if (matching.length >= item.expected_count_min) return 'complete';
    if (matching.length > 0) return 'partial';
    return 'missing';
  }

  async function toggleCompleted(item: FirmChecklistItem) {
    const existing = itemStates.find(s => s.doc_type === item.doc_type);
    setSaving(item.doc_type);
    const now = new Date().toISOString();
    if (existing) {
      const next = !existing.completed;
      await sbPatch('trustee_341_checklist_state', existing.id, {
        completed: next,
        completed_at: next ? now : null,
        completed_by: next ? 'Staff' : null,
        updated_at: now,
      });
      setItemStates(prev =>
        prev.map(s => s.doc_type === item.doc_type
          ? { ...s, completed: next, completed_at: next ? now : null, completed_by: next ? 'Staff' : null }
          : s
        )
      );
    } else {
      const created = await sbPost<ChecklistItemState>('trustee_341_checklist_state', {
        request_id: req.id,
        firm_id: firmId,
        doc_type: item.doc_type,
        completed: true,
        completed_at: now,
        completed_by: 'Staff',
      });
      if (created) setItemStates(prev => [...prev, created]);
    }
    setSaving('');
  }

  async function saveNotes(item: FirmChecklistItem) {
    const notes = editNotes[item.doc_type] ?? '';
    const existing = itemStates.find(s => s.doc_type === item.doc_type);
    if (existing) {
      await sbPatch('trustee_341_checklist_state', existing.id, { notes, updated_at: new Date().toISOString() });
      setItemStates(prev => prev.map(s => s.doc_type === item.doc_type ? { ...s, notes } : s));
    } else {
      const created = await sbPost<ChecklistItemState>('trustee_341_checklist_state', {
        request_id: req.id, firm_id: firmId, doc_type: item.doc_type, completed: false, notes,
      });
      if (created) setItemStates(prev => [...prev, created]);
    }
    setEditNotes(prev => { const n = { ...prev }; delete n[item.doc_type]; return n; });
  }

  const requiredItems = checklistItems.filter(i => i.required);
  const allRequiredComplete = requiredItems.length > 0 && requiredItems.every(i => getItemStatus(i) === 'complete');
  const completeCount = requiredItems.filter(i => getItemStatus(i) === 'complete').length;

  async function handleSubmit() {
    setSubmitting(true);
    await sbPost('trustee_submission_log', {
      firm_id: firmId,
      submission_method: 'portal_manual',
      notes: `341 checklist complete for ${req.client_name}${req.case_number ? ` (case: ${req.case_number})` : ''}. Submitted via Trustee Document Portal.`,
      documents_included: [],
    });
    await sbPatch('trustee_document_requests', req.id, {
      submitted_to_trustee_at: new Date().toISOString(),
      status: 'complete',
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-700/40 text-xs text-slate-600">
        <RefreshCw className="w-3 h-3 animate-spin" /> Loading 341 checklist…
      </div>
    );
  }
  if (checklistItems.length === 0) return null;

  return (
    <div className="border-t border-slate-700/40 bg-[#080c18]/40">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-800/40">
        <ClipboardList className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span className="text-xs font-bold text-slate-300">341 Checklist</span>
        <span className="text-[11px] text-slate-600 ml-1">
          {completeCount}/{requiredItems.length} required
        </span>
        {allRequiredComplete && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-900/25 border border-emerald-700/40 px-2 py-0.5 rounded-lg">
            <CheckCircle2 className="w-3 h-3" /> Ready for 341 Meeting
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-slate-800/30">
        {checklistItems.map(item => {
          const status = getItemStatus(item);
          const stateRow = itemStates.find(s => s.doc_type === item.doc_type);
          const isEditing = item.doc_type in editNotes;
          const notesVal = isEditing ? (editNotes[item.doc_type] ?? '') : (stateRow?.notes ?? '');

          return (
            <div key={item.id} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleCompleted(item)}
                  disabled={saving === item.doc_type}
                  className="flex-shrink-0 transition-opacity hover:opacity-70"
                  title={status === 'complete' ? 'Mark incomplete' : 'Mark complete'}
                >
                  {saving === item.doc_type
                    ? <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
                    : status === 'complete'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : status === 'partial'
                    ? <Circle className="w-4 h-4 text-amber-400" />
                    : <Circle className="w-4 h-4 text-slate-600" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${status === 'complete' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {item.display_label}
                    {item.expected_count_min > 1 && (
                      <span className="text-slate-600 font-normal ml-1">({item.expected_count_min}+ required)</span>
                    )}
                  </p>
                  {item.description && <p className="text-[11px] text-slate-600 mt-0.5">{item.description}</p>}
                </div>
                {item.required && (
                  <span className="text-[10px] font-bold text-red-400 border border-red-700/40 bg-red-900/20 px-1.5 py-0.5 rounded flex-shrink-0">REQ</span>
                )}
                {status === 'complete' && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/20 border border-emerald-700/40 px-1.5 py-0.5 rounded flex-shrink-0">
                    {stateRow?.completed ? 'STAFF' : 'AUTO'}
                  </span>
                )}
                {status === 'partial' && (
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-900/20 border border-amber-700/40 px-1.5 py-0.5 rounded flex-shrink-0">PARTIAL</span>
                )}
              </div>

              {/* Notes */}
              {isEditing ? (
                <div className="mt-1.5 ml-7 flex items-center gap-2">
                  <input
                    autoFocus
                    className="flex-1 bg-slate-800/60 border border-slate-700/60 text-white text-xs rounded-lg px-2 py-1 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                    value={notesVal}
                    onChange={e => setEditNotes(prev => ({ ...prev, [item.doc_type]: e.target.value }))}
                    placeholder="Add note…"
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveNotes(item);
                      if (e.key === 'Escape') setEditNotes(prev => { const n = { ...prev }; delete n[item.doc_type]; return n; });
                    }}
                  />
                  <button onClick={() => saveNotes(item)} className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Save className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEditNotes(prev => { const n = { ...prev }; delete n[item.doc_type]; return n; })}
                    className="p-1 rounded text-slate-500 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : stateRow?.notes ? (
                <div className="mt-1 ml-7 flex items-center gap-1.5">
                  <p className="text-[11px] text-slate-500 italic flex-1">{stateRow.notes}</p>
                  <button
                    onClick={() => setEditNotes(prev => ({ ...prev, [item.doc_type]: stateRow.notes ?? '' }))}
                    className="p-0.5 text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditNotes(prev => ({ ...prev, [item.doc_type]: '' }))}
                  className="mt-1 ml-7 text-[10px] text-slate-700 hover:text-slate-500 transition-colors"
                >
                  + note
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Ready banner + submit */}
      {allRequiredComplete && (
        <div className="m-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-300">Ready for Manual Submission</p>
            <p className="text-xs text-emerald-500/80 mt-0.5">All required 341 documents confirmed.</p>
          </div>
          {submitted ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-3 py-1.5 rounded-lg flex-shrink-0">
              <Check className="w-3 h-3" /> Submitted
            </span>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {submitting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Submit to Trustee
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 341 Checklist Config Panel — firm-level customization ────────────────────

function ChecklistConfigPanel({ firmId }: { firmId: string }) {
  const [items, setItems] = useState<FirmChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newItem, setNewItem] = useState({
    doc_type: '', display_label: '', description: '', required: true,
    category: '', expected_count_min: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await sbGet<FirmChecklistItem>(
      `firm_trustee_doc_checklist?firm_id=eq.${firmId}&order=sort_order.asc`
    );
    setItems(data);
    setLoading(false);
  }, [firmId]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(item: FirmChecklistItem) {
    await sbPatch('firm_trustee_doc_checklist', item.id, { is_active: !item.is_active });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  }

  async function toggleRequired(item: FirmChecklistItem) {
    await sbPatch('firm_trustee_doc_checklist', item.id, { required: !item.required });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, required: !i.required } : i));
  }

  async function deleteItem(item: FirmChecklistItem) {
    if (!confirm(`Remove "${item.display_label}" from your firm's 341 checklist?`)) return;
    await sbDelete('firm_trustee_doc_checklist', item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  async function addItem() {
    if (!newItem.doc_type.trim() || !newItem.display_label.trim()) return;
    setSaving(true);
    const created = await sbPost<FirmChecklistItem>('firm_trustee_doc_checklist', {
      firm_id: firmId,
      doc_type: newItem.doc_type.trim().toLowerCase().replace(/\s+/g, '_'),
      display_label: newItem.display_label.trim(),
      description: newItem.description || null,
      required: newItem.required,
      category: newItem.category || null,
      expected_count_min: newItem.expected_count_min,
      sort_order: (items[items.length - 1]?.sort_order ?? 0) + 10,
      is_active: true,
    });
    setSaving(false);
    if (created) {
      setItems(prev => [...prev, created]);
      setNewItem({ doc_type: '', display_label: '', description: '', required: true, category: '', expected_count_min: 1 });
      setShowAddForm(false);
    }
  }

  async function resetToDefaults() {
    if (!confirm('Reset to platform defaults? All firm-specific items will be replaced with the standard 6-item list.')) return;
    setResetting(true);
    for (const item of items) { await sbDelete('firm_trustee_doc_checklist', item.id); }
    const defaults = await sbGet<ChecklistDefault>('trustee_doc_checklist_defaults?order=sort_order.asc');
    for (const d of defaults) {
      await sbPost('firm_trustee_doc_checklist', {
        firm_id: firmId, doc_type: d.doc_type, display_label: d.display_label,
        description: d.description, required: d.required, applies_to: d.applies_to,
        expected_count_min: d.expected_count_min, category: d.category,
        sort_order: d.sort_order, is_active: true,
      });
    }
    setResetting(false);
    load();
  }

  const byCategory = items.reduce<Record<string, FirmChecklistItem[]>>((acc, item) => {
    const key = item.category ?? 'general';
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});

  const activeCount = items.filter(i => i.is_active).length;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <ClipboardList className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">341 Meeting Checklist</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeCount} active item{activeCount !== 1 ? 's' : ''} — shown when reviewing client doc requests
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefaults}
              disabled={resetting || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700/50 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
              Reset to defaults
            </button>
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
            <p className="text-xs font-bold text-white">New Checklist Item</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Display Label *</label>
                <input className={inp} value={newItem.display_label}
                  onChange={e => setNewItem(p => ({ ...p, display_label: e.target.value }))}
                  placeholder="e.g. Recent Utility Bill" />
              </div>
              <div>
                <label className={lbl}>Key (doc_type) *</label>
                <input className={inp} value={newItem.doc_type}
                  onChange={e => setNewItem(p => ({ ...p, doc_type: e.target.value }))}
                  placeholder="e.g. utility_bill" />
              </div>
              <div>
                <label className={lbl}>Category</label>
                <input className={inp} value={newItem.category}
                  onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                  placeholder="identity / financial / tax / income" />
              </div>
              <div>
                <label className={lbl}>Min Expected Count</label>
                <input className={inp} type="number" min={1} value={newItem.expected_count_min}
                  onChange={e => setNewItem(p => ({ ...p, expected_count_min: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div>
              <label className={lbl}>Description</label>
              <input className={inp} value={newItem.description}
                onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional detail shown to staff" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewItem(p => ({ ...p, required: !p.required }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${newItem.required ? 'bg-red-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newItem.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-slate-400">{newItem.required ? 'Required' : 'Optional'}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowAddForm(false)} className="flex-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={addItem}
                disabled={saving || !newItem.doc_type.trim() || !newItem.display_label.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Add Item
              </button>
            </div>
          </div>
        )}

        {/* Items by category */}
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <ClipboardList className="w-9 h-9 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No checklist items configured.</p>
            <p className="text-xs mt-1">Add items or reset to platform defaults to restore the standard 6-item list.</p>
          </div>
        ) : (
          Object.entries(byCategory).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3 h-3 text-slate-600" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{cat}</span>
                <span className="text-[10px] text-slate-700">{catItems.length}</span>
              </div>
              <div className="space-y-1.5 pl-2">
                {catItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      item.is_active
                        ? 'bg-slate-800/30 border-slate-700/30'
                        : 'bg-slate-900/20 border-slate-800/20 opacity-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${item.is_active ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                        {item.display_label}
                        {item.expected_count_min > 1 && (
                          <span className="text-slate-600 font-normal ml-1">({item.expected_count_min}+)</span>
                        )}
                      </p>
                      {item.description && <p className="text-[11px] text-slate-600 mt-0.5">{item.description}</p>}
                    </div>
                    {/* Required badge + toggle */}
                    <button
                      onClick={() => toggleRequired(item)}
                      title={item.required ? 'Click to make optional' : 'Click to make required'}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 transition-colors ${
                        item.required
                          ? 'text-red-400 bg-red-900/25 border-red-700/30 hover:bg-red-900/40'
                          : 'text-slate-500 bg-slate-800/40 border-slate-700/30 hover:text-slate-300'
                      }`}
                    >
                      {item.required ? 'REQ' : 'OPT'}
                    </button>
                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(item)}
                      title={item.is_active ? 'Deactivate item' : 'Activate item'}
                      className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${item.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => deleteItem(item)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Trustee Detail Panel ─────────────────────────────────────────────────────

function TrusteeDetailPanel({
  trustee, states, chapters, categories, onUpdate,
}: {
  trustee: Trustee;
  states: TrusteeState[];
  chapters: ChapterType[];
  categories: DocCategory[];
  onUpdate: () => void;
}) {
  const [tab, setTab] = useState<'requirements' | 'requests'>('requirements');
  const [requirements, setRequirements] = useState<DocRequirement[]>([]);
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [requestItems, setRequestItems] = useState<Record<string, RequestItem[]>>({});
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [showReqModal, setShowReqModal] = useState(false);
  const [editReq, setEditReq] = useState<DocRequirement | undefined>(undefined);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showEditTrustee, setShowEditTrustee] = useState(false);
  const [followupLogRequest, setFollowupLogRequest] = useState<DocRequest | null>(null);
  const [sendingFollowup, setSendingFollowup] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const state = states.find(s => s.id === trustee.state_id);
  const chapter = chapters.find(c => c.id === trustee.chapter_type_id);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [reqs, reqs2] = await Promise.all([
      sbGet<DocRequirement>(`trustee_document_requirements?trustee_id=eq.${trustee.id}&order=sort_order.asc`),
      sbGet<DocRequest>(`trustee_document_requests?trustee_id=eq.${trustee.id}&order=created_at.desc`),
    ]);
    setRequirements(reqs);
    setRequests(reqs2);
    setLoading(false);
  }, [trustee.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function loadRequestItems(requestId: string) {
    const items = await sbGet<RequestItem>(`trustee_request_items?request_id=eq.${requestId}&order=document_name.asc`);
    setRequestItems(prev => ({ ...prev, [requestId]: items }));
  }

  function toggleRequest(id: string) {
    setExpandedRequests(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); loadRequestItems(id); }
      return n;
    });
  }

  async function updateItemStatus(itemId: string, requestId: string, status: string) {
    await sbPatch('trustee_request_items', itemId, {
      status,
      submitted_at: status === 'uploaded' ? new Date().toISOString() : undefined,
    });
    loadRequestItems(requestId);
  }

  async function deleteRequirement(id: string) {
    if (!confirm('Delete this document requirement?')) return;
    await sbDelete('trustee_document_requirements', id);
    setRequirements(prev => prev.filter(r => r.id !== id));
  }

  async function sendManualFollowup(req: DocRequest) {
    setSendingFollowup(req.id);
    const needsItems = (requestItems[req.id] ?? []).filter(i => i.status === 'needed' || i.status === 'rejected');
    const missingList = needsItems.map(i => `• ${i.document_name}`).join('\n');
    const hearingStr = req.hearing_341_date
      ? new Date(req.hearing_341_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'your upcoming hearing';
    const message = `Manual follow-up sent. ${needsItems.length} document${needsItems.length !== 1 ? 's' : ''} still needed before ${hearingStr}.\n${missingList}`;
    const now = new Date().toISOString();
    await sbPost('trustee_followup_log', {
      request_id: req.id,
      sent_at: now,
      followup_type: 'manual',
      method: 'email',
      message,
      sent_by: 'Staff',
    });
    await sbPatch('trustee_document_requests', req.id, {
      last_followup_at: now,
      last_followup_type: 'manual',
      followup_count: (req.followup_count ?? 0) + 1,
    });
    setRequests(prev => prev.map(r => r.id === req.id
      ? { ...r, last_followup_at: now, last_followup_type: 'manual', followup_count: (r.followup_count ?? 0) + 1 }
      : r
    ));
    setSendingFollowup('');
  }

  async function toggleAutoFollowup(req: DocRequest) {
    const next = !req.auto_followup_enabled;
    await sbPatch('trustee_document_requests', req.id, { auto_followup_enabled: next });
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, auto_followup_enabled: next } : r));
  }

  function getCategoryName(catId: string | null) {
    if (!catId) return null;
    return categories.find(c => c.id === catId)?.name ?? null;
  }

  function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function daysUntil(d: string | null): number | null {
    if (!d) return null;
    const diff = new Date(d).getTime() - new Date().setHours(0, 0, 0, 0);
    return Math.ceil(diff / 86400000);
  }

  function hearingUrgency(days: number | null): string {
    if (days === null) return '';
    if (days < 0) return 'text-red-400';
    if (days <= 7) return 'text-red-400';
    if (days <= 14) return 'text-amber-400';
    return 'text-slate-400';
  }

  const reqsByCategory = requirements.reduce<Record<string, DocRequirement[]>>((acc, r) => {
    const key = r.category_id ?? '__uncategorized';
    acc[key] = [...(acc[key] ?? []), r];
    return acc;
  }, {});

  // Summary stats for requests tab header
  const openCount = requests.filter(r => r.status === 'open' || r.status === 'in_review').length;
  const overdueCount = requests.filter(r => {
    const d = daysUntil(r.doc_due_date);
    return d !== null && d < 0 && r.status !== 'complete' && r.status !== 'closed';
  }).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Trustee header */}
      <div className="px-5 py-4 border-b border-slate-800/60 bg-[#0a1020]/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600/30 to-sky-900/50 border border-sky-700/40 flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{trustee.name}</h3>
              {trustee.district && <p className="text-xs text-slate-500 mt-0.5">{trustee.district}</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {state && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <MapPin className="w-3 h-3" />{state.name}
                  </span>
                )}
                {chapter && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${CHAPTER_COLORS[chapter.code] ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                    {chapter.name}
                  </span>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${trustee.active ? 'text-emerald-400 bg-emerald-900/25 border-emerald-700/40' : 'text-slate-500 bg-slate-800/40 border-slate-700/40'}`}>
                  {trustee.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={() => setShowEditTrustee(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-3 mt-3 flex-wrap">
          {trustee.email && (
            <a href={`mailto:${trustee.email}`} className="flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 transition-colors">
              <Mail className="w-3 h-3" />{trustee.email}
            </a>
          )}
          {trustee.phone && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Phone className="w-3 h-3" />{trustee.phone}
            </span>
          )}
        </div>
        {trustee.notes && <p className="text-xs text-slate-500 mt-2 italic">{trustee.notes}</p>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800/60 px-4 pt-2 gap-1">
        {(['requirements', 'requests'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
              tab === t ? 'text-white bg-slate-800 border border-b-0 border-slate-700/60' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'requirements'
              ? `Doc Requirements (${requirements.length})`
              : (
                <span className="flex items-center gap-1.5">
                  Client Requests ({requests.length})
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold">{overdueCount}</span>
                  )}
                </span>
              )
            }
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : tab === 'requirements' ? (
          /* ── Requirements Tab ─────────────────────────────────────────── */
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{requirements.length} document{requirements.length !== 1 ? 's' : ''} configured</p>
              <button
                onClick={() => { setEditReq(undefined); setShowReqModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600/20 border border-teal-600/30 text-teal-400 hover:bg-teal-600/30 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Document
              </button>
            </div>
            {requirements.length === 0 ? (
              <div className="text-center py-10 text-slate-600">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No document requirements yet.</p>
                <p className="text-xs mt-1">Add the documents this trustee requests.</p>
              </div>
            ) : (
              Object.entries(reqsByCategory).map(([catId, reqs]) => {
                const catName = catId === '__uncategorized' ? 'Uncategorized' : (getCategoryName(catId) ?? 'Uncategorized');
                return (
                  <div key={catId}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Tag className="w-3 h-3 text-slate-600" />
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{catName}</span>
                    </div>
                    <div className="space-y-1.5 pl-2">
                      {reqs.map(req => (
                        <div key={req.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30 group">
                          <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-200 truncate">{req.document_name}</p>
                            {req.description && <p className="text-[11px] text-slate-500 truncate">{req.description}</p>}
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${req.required ? 'text-red-400 bg-red-900/25 border-red-700/30' : 'text-slate-500 bg-slate-800/40 border-slate-700/30'}`}>
                            {req.required ? 'REQ' : 'OPT'}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditReq(req); setShowReqModal(true); }} className="p-1 rounded text-slate-500 hover:text-sky-400 transition-colors"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => deleteRequirement(req.id)} className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ── Requests Tab ─────────────────────────────────────────────── */
          <div className="p-4 space-y-3">
            {/* Summary row */}
            {requests.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs text-slate-500 flex-1">{requests.length} client request{requests.length !== 1 ? 's' : ''}{openCount > 0 ? ` · ${openCount} active` : ''}</p>
                {overdueCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-900/20 border border-red-800/40 px-2 py-1 rounded-lg">
                    <AlertCircle className="w-3 h-3" />{overdueCount} overdue
                  </span>
                )}
                <button
                  onClick={() => setShowNewRequestModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 border border-amber-600/30 text-amber-400 hover:bg-amber-600/30 transition-colors"
                >
                  <Plus className="w-3 h-3" /> New Request
                </button>
              </div>
            )}

            {requests.length === 0 ? (
              <div className="text-center py-10 text-slate-600">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No client requests yet.</p>
                <p className="text-xs mt-1">Create a request to track documents for a client.</p>
                <button
                  onClick={() => setShowNewRequestModal(true)}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 border border-amber-600/30 text-amber-400 hover:bg-amber-600/30 transition-colors mx-auto"
                >
                  <Plus className="w-3 h-3" /> New Request
                </button>
              </div>
            ) : (
              requests.map(req => {
                const expanded = expandedRequests.has(req.id);
                const items = requestItems[req.id] ?? [];
                const st = REQUEST_STATUS[req.status] ?? REQUEST_STATUS.open;
                const totalItems = items.length;
                const approvedCount = items.filter(i => i.status === 'approved').length;
                const uploadedCount = items.filter(i => i.status === 'uploaded').length;
                const neededCount = items.filter(i => i.status === 'needed').length;
                const rejectedCount = items.filter(i => i.status === 'rejected').length;
                const daysTo341 = daysUntil(req.hearing_341_date);
                const daysToDue = daysUntil(req.doc_due_date);
                const isOverdue = daysToDue !== null && daysToDue < 0 && req.status !== 'complete' && req.status !== 'closed';

                return (
                  <div key={req.id} className={`rounded-xl border overflow-hidden transition-colors ${
                    isOverdue ? 'border-red-800/50' : 'border-slate-700/40'
                  }`}>
                    {/* Card header — always visible */}
                    <button
                      onClick={() => toggleRequest(req.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                        isOverdue ? 'bg-red-950/20 hover:bg-red-950/30' : 'bg-slate-800/30 hover:bg-slate-800/50'
                      }`}
                    >
                      {expanded
                        ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                        : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />}

                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Row 1: name + case number + status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{req.client_name}</p>
                          {req.case_number && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono bg-slate-800/60 px-1.5 py-0.5 rounded">
                              <Hash className="w-2.5 h-2.5" />{req.case_number}
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                          {isOverdue && (
                            <span className="text-[10px] font-bold text-red-400 bg-red-900/30 border border-red-700/40 px-1.5 py-0.5 rounded">OVERDUE</span>
                          )}
                        </div>

                        {/* Row 2: dates */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {req.hearing_341_date && (
                            <span className={`flex items-center gap-1 text-[11px] font-medium ${hearingUrgency(daysTo341)}`}>
                              <Calendar className="w-3 h-3" />
                              341: {fmtDate(req.hearing_341_date)}
                              {daysTo341 !== null && (
                                <span className="text-[10px]">
                                  ({daysTo341 < 0 ? `${Math.abs(daysTo341)}d ago` : daysTo341 === 0 ? 'Today' : `in ${daysTo341}d`})
                                </span>
                              )}
                            </span>
                          )}
                          {req.doc_due_date && (
                            <span className={`flex items-center gap-1 text-[11px] ${isOverdue ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                              <Clock className="w-3 h-3" />
                              Docs due: {fmtDate(req.doc_due_date)}
                            </span>
                          )}
                        </div>

                        {/* Row 3: doc completion bar + follow-up info */}
                        {totalItems > 0 && (
                          <div className="flex items-center gap-2">
                            {/* Mini progress bar */}
                            <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  req.status === 'complete' ? 'bg-emerald-500' :
                                  rejectedCount > 0 ? 'bg-red-500' :
                                  approvedCount + uploadedCount >= totalItems ? 'bg-emerald-500' :
                                  'bg-sky-500'
                                }`}
                                style={{ width: `${Math.round(((approvedCount + uploadedCount) / totalItems) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-500 flex-shrink-0">
                              {approvedCount + uploadedCount}/{totalItems}
                              {rejectedCount > 0 && <span className="text-red-400 ml-1">· {rejectedCount} rejected</span>}
                              {neededCount > 0 && <span className="text-amber-400 ml-1">· {neededCount} needed</span>}
                            </span>
                          </div>
                        )}

                        {/* Row 4: last follow-up */}
                        {req.last_followup_at && (
                          <div className="flex items-center gap-1.5">
                            {req.last_followup_type === 'auto'
                              ? <Bell className="w-3 h-3 text-teal-500" />
                              : <Send className="w-3 h-3 text-amber-500" />}
                            <span className="text-[11px] text-slate-600">
                              Last {req.last_followup_type === 'auto' ? 'auto' : 'manual'} follow-up: {fmtDate(req.last_followup_at)}
                              {req.followup_count > 0 && ` (${req.followup_count} total)`}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {expanded && (
                      <div className="border-t border-slate-700/40 bg-slate-900/30">
                        {/* Client contact + notes */}
                        {(req.client_email || req.client_phone || req.notes) && (
                          <div className="px-4 py-2.5 border-b border-slate-800/60 flex flex-wrap gap-3 items-center">
                            {req.client_email && (
                              <a href={`mailto:${req.client_email}`} className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors">
                                <Mail className="w-3 h-3" />{req.client_email}
                              </a>
                            )}
                            {req.client_phone && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Phone className="w-3 h-3" />{req.client_phone}
                              </span>
                            )}
                            {req.submitted_at && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Upload className="w-3 h-3" />Submitted {fmtDate(req.submitted_at)}
                              </span>
                            )}
                            {req.notes && <p className="w-full text-xs text-slate-500 italic">{req.notes}</p>}
                          </div>
                        )}

                        {/* Document items */}
                        {items.length === 0 ? (
                          <div className="flex items-center justify-center py-4">
                            <RefreshCw className="w-3.5 h-3.5 text-slate-600 animate-spin" />
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-800/60">
                            {items.map(item => {
                              const ist = REQ_STATUS[item.status] ?? REQ_STATUS.needed;
                              return (
                                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${ist.color}`}>
                                    {ist.icon}{ist.label}
                                  </span>
                                  <span className="text-xs text-slate-300 flex-1">{item.document_name}</span>
                                  {item.submitted_at && (
                                    <span className="text-[10px] text-slate-600 flex-shrink-0">{fmtDate(item.submitted_at)}</span>
                                  )}
                                  {item.required && <span className="text-[10px] text-red-400 flex-shrink-0">REQ</span>}
                                  <select
                                    value={item.status}
                                    onChange={e => updateItemStatus(item.id, req.id, e.target.value)}
                                    className="text-[11px] bg-slate-800 border border-slate-700/60 text-slate-300 rounded-lg px-2 py-1 focus:outline-none"
                                  >
                                    <option value="needed">Needed</option>
                                    <option value="uploaded">Uploaded</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="waived">Waived</option>
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 341 Checklist */}
                        <RequestChecklistSection req={req} firmId={V1_DEFAULT_FIRM_ID} />

                        {/* Actions bar */}
                        <div className="px-4 py-2.5 flex items-center gap-2 border-t border-slate-800/60 flex-wrap">
                          {/* Status buttons */}
                          <div className="flex gap-1.5 flex-1 flex-wrap">
                            {(['open', 'in_review', 'complete', 'closed'] as const).map(s => (
                              <button
                                key={s}
                                onClick={async () => {
                                  await sbPatch('trustee_document_requests', req.id, { status: s });
                                  setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: s } : r));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  req.status === s ? REQUEST_STATUS[s].color : 'text-slate-500 border-slate-700/40 hover:text-slate-300'
                                }`}
                              >
                                {REQUEST_STATUS[s].label}
                              </button>
                            ))}
                          </div>

                          {/* Follow-up controls */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setFollowupLogRequest(req)}
                              title="Follow-up history"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleAutoFollowup(req)}
                              title={req.auto_followup_enabled ? 'Auto follow-ups ON — click to disable' : 'Auto follow-ups OFF — click to enable'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                req.auto_followup_enabled
                                  ? 'text-teal-400 bg-teal-900/20 hover:bg-teal-900/30'
                                  : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              {req.auto_followup_enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => sendManualFollowup(req)}
                              disabled={sendingFollowup === req.id || req.status === 'complete' || req.status === 'closed'}
                              title="Send manual follow-up"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-600/20 border border-amber-600/30 text-amber-400 hover:bg-amber-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {sendingFollowup === req.id
                                ? <RefreshCw className="w-3 h-3 animate-spin" />
                                : <Send className="w-3 h-3" />}
                              Push Follow-up
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {showReqModal && (
        <RequirementModal
          trusteeId={trustee.id}
          categories={categories.filter(c => !c.chapter_type_id || c.chapter_type_id === trustee.chapter_type_id)}
          existing={editReq}
          onSave={saved => {
            setRequirements(prev => {
              const idx = prev.findIndex(r => r.id === saved.id);
              return idx >= 0 ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved];
            });
            setShowReqModal(false);
            setEditReq(undefined);
          }}
          onClose={() => { setShowReqModal(false); setEditReq(undefined); }}
        />
      )}
      {showNewRequestModal && (
        <NewRequestModal
          trustee={trustee}
          requirements={requirements}
          onSave={(docReq, items) => {
            setRequests(prev => [docReq, ...prev]);
            setRequestItems(prev => ({ ...prev, [docReq.id]: items }));
            setExpandedRequests(prev => new Set([...prev, docReq.id]));
            setShowNewRequestModal(false);
            setTab('requests');
          }}
          onClose={() => setShowNewRequestModal(false)}
        />
      )}
      {showEditTrustee && (
        <TrusteeModal
          trustee={trustee}
          states={states}
          chapters={chapters}
          onSave={() => { setShowEditTrustee(false); onUpdate(); }}
          onClose={() => setShowEditTrustee(false)}
        />
      )}
      {followupLogRequest && (
        <FollowupLogModal
          request={followupLogRequest}
          onClose={() => setFollowupLogRequest(null)}
        />
      )}
    </div>
  );
}

// ─── Local Forms Panel ────────────────────────────────────────────────────────

const DISTRICT_META: Record<string, { label: string; color: string }> = {
  AZ:   { label: 'District of Arizona',               color: 'text-amber-400 bg-amber-900/25 border-amber-700/40' },
  E_WA: { label: 'Eastern District of Washington',    color: 'text-sky-400 bg-sky-900/25 border-sky-700/40' },
  W_WA: { label: 'Western District of Washington',    color: 'text-teal-400 bg-teal-900/25 border-teal-700/40' },
  N_TX: { label: 'Northern District of Texas',        color: 'text-rose-400 bg-rose-900/25 border-rose-700/40' },
};

const CHAP_FILTER_COLORS: Record<string, string> = {
  All:          'text-slate-300 bg-slate-700/60 border-slate-600/50',
  'Chapter 7':  'text-sky-400 bg-sky-900/30 border-sky-700/40',
  'Chapter 11': 'text-amber-400 bg-amber-900/30 border-amber-700/40',
  'Chapter 12': 'text-orange-400 bg-orange-900/30 border-orange-700/40',
  'Chapter 13': 'text-teal-400 bg-teal-900/30 border-teal-700/40',
  Adversary:    'text-slate-400 bg-slate-800/50 border-slate-600/40',
};

// ─── 341 Calendar Panel ───────────────────────────────────────────────────────

function CalendarPanel() {
  const [allRequests, setAllRequests] = useState<DocRequest[]>([]);
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [states, setStates] = useState<TrusteeState[]>([]);
  const [chapters, setChapters] = useState<ChapterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    Promise.all([
      sbGet<DocRequest>('trustee_document_requests?order=hearing_341_date.asc'),
      sbGet<Trustee>('trustees?order=name.asc'),
      sbGet<TrusteeState>('trustee_states?order=name.asc'),
      sbGet<ChapterType>('trustee_chapter_types?order=sort_order.asc'),
    ]).then(([reqs, trs, sts, chs]) => {
      setAllRequests(reqs.filter(r => r.hearing_341_date));
      setTrustees(trs);
      setStates(sts);
      setChapters(chs);
      setLoading(false);
    });
  }, []);

  const { year, month } = calMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const hearingsByDate = allRequests.reduce<Record<string, DocRequest[]>>((acc, r) => {
    const d = r.hearing_341_date!.split('T')[0];
    acc[d] = [...(acc[d] ?? []), r];
    return acc;
  }, {});

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function cellDate(day: number) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function urgencyColor(req: DocRequest) {
    const d = new Date(req.hearing_341_date!).getTime() - today.setHours(0,0,0,0);
    const days = Math.ceil(d / 86400000);
    if (days < 0) return 'bg-slate-700/60 text-slate-500';
    if (days <= 7) return 'bg-red-900/60 text-red-300 border-l-2 border-red-500';
    if (days <= 14) return 'bg-amber-900/50 text-amber-300 border-l-2 border-amber-500';
    return 'bg-sky-900/40 text-sky-300 border-l-2 border-sky-600';
  }

  const upcomingList = allRequests
    .filter(r => {
      const d = new Date(r.hearing_341_date!).getTime() - new Date().setHours(0,0,0,0);
      return d >= 0 && Math.ceil(d / 86400000) <= 30;
    })
    .sort((a,b) => a.hearing_341_date!.localeCompare(b.hearing_341_date!));

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col min-h-0 p-5">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalMonth(m => {
              const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() };
            })}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <h2 className="text-base font-bold text-white">{monthNames[month]} {year}</h2>
          <button
            onClick={() => setCalMonth(m => {
              const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() };
            })}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-slate-600 py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 flex-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="rounded-xl bg-slate-900/20 min-h-[80px]" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = cellDate(day);
              const hearings = hearingsByDate[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={day}
                  className={`rounded-xl p-1.5 min-h-[80px] border flex flex-col ${
                    isToday
                      ? 'bg-sky-950/40 border-sky-700/50'
                      : 'bg-slate-900/30 border-slate-800/40'
                  }`}
                >
                  <span className={`text-xs font-semibold mb-1 ${isToday ? 'text-sky-400' : 'text-slate-500'}`}>{day}</span>
                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    {hearings.slice(0, 3).map(req => {
                      const trustee = trustees.find(t => t.id === req.trustee_id);
                      const ch = chapters.find(c => c.id === trustee?.chapter_type_id);
                      return (
                        <div
                          key={req.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${urgencyColor(req)}`}
                          title={`${req.client_name} — ${trustee?.name ?? ''}`}
                        >
                          {req.client_name}
                          {ch && <span className="ml-0.5 opacity-70">{ch.code === 'ch7' ? '7' : '13'}</span>}
                        </div>
                      );
                    })}
                    {hearings.length > 3 && (
                      <div className="text-[9px] text-slate-600 pl-1">+{hearings.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/40">
          <span className="text-[11px] text-slate-600">Legend:</span>
          {[
            { color: 'bg-red-900/60 border-l-2 border-red-500', label: '≤7 days' },
            { color: 'bg-amber-900/50 border-l-2 border-amber-500', label: '≤14 days' },
            { color: 'bg-sky-900/40 border-l-2 border-sky-600', label: '>14 days' },
            { color: 'bg-slate-700/60', label: 'Past' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`inline-block w-4 h-3 rounded ${color}`} />
              <span className="text-[11px] text-slate-500">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right sidebar: upcoming 30-day list */}
      <div className="w-72 border-l border-slate-800/60 flex flex-col bg-[#090f1d]">
        <div className="px-4 py-3 border-b border-slate-800/60">
          <h3 className="text-xs font-bold text-white">Upcoming 341 Hearings</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Next 30 days · {upcomingList.length} scheduled</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {upcomingList.length === 0 ? (
            <div className="text-center py-10 text-slate-600">
              <Calendar className="w-7 h-7 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No hearings in next 30 days</p>
            </div>
          ) : upcomingList.map(req => {
            const d = new Date(req.hearing_341_date!).getTime() - new Date().setHours(0,0,0,0);
            const days = Math.ceil(d / 86400000);
            const trustee = trustees.find(t => t.id === req.trustee_id);
            const state = states.find(s => s.id === trustee?.state_id);
            const ch = chapters.find(c => c.id === trustee?.chapter_type_id);
            const st = REQUEST_STATUS[req.status] ?? REQUEST_STATUS.open;
            return (
              <div key={req.id} className="px-4 py-3 hover:bg-slate-800/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{req.client_name}</p>
                    {req.case_number && <p className="text-[10px] text-slate-600 font-mono">{req.case_number}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    days <= 7 ? 'text-red-400 bg-red-900/30 border-red-700/40' :
                    days <= 14 ? 'text-amber-400 bg-amber-900/30 border-amber-700/40' :
                    'text-sky-400 bg-sky-900/30 border-sky-700/40'
                  }`}>{days}d</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[10px] text-slate-500">{new Date(req.hearing_341_date!).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                  {ch && <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${CHAPTER_COLORS[ch.code] ?? ''}`}>{ch.name}</span>}
                  {state && <span className="text-[10px] text-slate-600">{state.abbreviation}</span>}
                  <span className={`text-[9px] font-semibold px-1 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                </div>
                {req.doc_due_date && (() => {
                  const docDays = Math.ceil((new Date(req.doc_due_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                  return docDays <= 0 ? (
                    <p className="text-[10px] text-red-400 mt-0.5 font-semibold">Docs OVERDUE {Math.abs(docDays)}d</p>
                  ) : (
                    <p className="text-[10px] text-slate-600 mt-0.5">Docs due in {docDays}d</p>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Priority Task List Panel ─────────────────────────────────────────────────

function TaskListPanel() {
  const [allRequests, setAllRequests] = useState<DocRequest[]>([]);
  const [allItems, setAllItems] = useState<Record<string, RequestItem[]>>({});
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [states, setStates] = useState<TrusteeState[]>([]);
  const [chapters, setChapters] = useState<ChapterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'elevated' | 'overdue'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [reqs, trs, sts, chs] = await Promise.all([
      sbGet<DocRequest>('trustee_document_requests?status=not.in.(complete,closed)&order=hearing_341_date.asc'),
      sbGet<Trustee>('trustees?order=name.asc'),
      sbGet<TrusteeState>('trustee_states?order=name.asc'),
      sbGet<ChapterType>('trustee_chapter_types?order=sort_order.asc'),
    ]);
    setAllRequests(reqs);
    setTrustees(trs);
    setStates(sts);
    setChapters(chs);
    // load items for each
    const itemMap: Record<string, RequestItem[]> = {};
    await Promise.all(reqs.map(async r => {
      const items = await sbGet<RequestItem>(`trustee_request_items?request_id=eq.${r.id}&order=document_name.asc`);
      itemMap[r.id] = items;
    }));
    setAllItems(itemMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function daysUntil(d: string | null) {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  }

  function priorityOf(req: DocRequest): 'critical' | 'elevated' | 'normal' {
    const days = daysUntil(req.hearing_341_date);
    if (days === null) return 'normal';
    if (days <= 10) return 'critical';
    if (days <= 14) return 'elevated';
    return 'normal';
  }

  async function sendFollowup(req: DocRequest) {
    setSendingId(req.id);
    const items = allItems[req.id] ?? [];
    const missing = items.filter(i => i.status === 'needed' || i.status === 'rejected');
    const now = new Date().toISOString();
    const days = daysUntil(req.hearing_341_date);
    const priority = priorityOf(req);
    const urgencyPrefix = priority === 'critical'
      ? `URGENT — 341 hearing in ${days} days. Daily reminders active.`
      : `Follow-up: 341 hearing in ${days} days.`;
    const message = `${urgencyPrefix} ${missing.length} document(s) still needed:\n${missing.map(i => `• ${i.document_name}`).join('\n')}`;
    await sbPost('trustee_followup_log', { request_id: req.id, sent_at: now, followup_type: 'auto', method: 'email', message, sent_by: 'System' });
    await sbPatch('trustee_document_requests', req.id, {
      last_followup_at: now, last_followup_type: 'auto',
      followup_count: (req.followup_count ?? 0) + 1,
      last_auto_reminder_at: now,
      priority_level: priority,
    });
    setAllRequests(prev => prev.map(r => r.id === req.id
      ? { ...r, last_followup_at: now, last_followup_type: 'auto', followup_count: (r.followup_count ?? 0) + 1 }
      : r
    ));
    setSendingId('');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = allRequests.filter(req => {
    const priority = priorityOf(req);
    const days = daysUntil(req.doc_due_date);
    const overdue = days !== null && days < 0;
    if (filter === 'critical') return priority === 'critical';
    if (filter === 'elevated') return priority === 'elevated';
    if (filter === 'overdue') return overdue;
    return true;
  });

  const criticalCount = allRequests.filter(r => priorityOf(r) === 'critical').length;
  const overdueCount = allRequests.filter(r => {
    const d = daysUntil(r.doc_due_date);
    return d !== null && d < 0;
  }).length;

  const PRIORITY_META = {
    critical: { label: 'Critical', color: 'text-red-400 bg-red-900/30 border-red-700/40', dot: 'bg-red-500' },
    elevated: { label: 'Elevated', color: 'text-amber-400 bg-amber-900/30 border-amber-700/40', dot: 'bg-amber-500' },
    normal:   { label: 'Normal',   color: 'text-slate-400 bg-slate-800/40 border-slate-700/40', dot: 'bg-slate-500' },
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header + filters */}
      <div className="px-5 py-3 border-b border-slate-800/60 flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white">Active Case Task List</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{allRequests.length} open cases · {criticalCount} critical · {overdueCount} overdue</p>
        </div>
        <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          {([
            { key: 'all', label: 'All' },
            { key: 'critical', label: `Critical (${criticalCount})` },
            { key: 'elevated', label: 'Elevated' },
            { key: 'overdue', label: `Overdue (${overdueCount})` },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.key
                  ? f.key === 'critical' || f.key === 'overdue' ? 'bg-red-700 text-white' :
                    f.key === 'elevated' ? 'bg-amber-700 text-white' : 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-white'
              }`}
            >{f.label}</button>
          ))}
        </div>
        <button onClick={load} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 text-slate-600 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No tasks in this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {filtered.map(req => {
              const items = allItems[req.id] ?? [];
              const priority = priorityOf(req);
              const pm = PRIORITY_META[priority];
              const daysTo341 = daysUntil(req.hearing_341_date);
              const daysToDue = daysUntil(req.doc_due_date);
              const overdue = daysToDue !== null && daysToDue < 0;
              const neededItems = items.filter(i => i.status === 'needed' || i.status === 'rejected');
              const approvedItems = items.filter(i => i.status === 'approved' || i.status === 'uploaded');
              const trustee = trustees.find(t => t.id === req.trustee_id);
              const state = states.find(s => s.id === trustee?.state_id);
              const ch = chapters.find(c => c.id === trustee?.chapter_type_id);
              const lastFollowupDays = req.last_auto_reminder_at
                ? Math.floor((new Date().getTime() - new Date(req.last_auto_reminder_at).getTime()) / 86400000)
                : null;
              const needsDailyReminder = priority === 'critical' && (lastFollowupDays === null || lastFollowupDays >= 1);

              return (
                <div
                  key={req.id}
                  className={`px-5 py-4 hover:bg-slate-800/10 transition-colors ${
                    priority === 'critical' ? 'border-l-2 border-red-600' :
                    priority === 'elevated' ? 'border-l-2 border-amber-500' :
                    'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Left: priority dot + client info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pm.dot} ${priority === 'critical' ? 'animate-pulse' : ''}`} />
                        <p className="text-sm font-bold text-white">{req.client_name}</p>
                        {req.case_number && (
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-800/60 px-1.5 py-0.5 rounded">{req.case_number}</span>
                        )}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pm.color}`}>{pm.label}</span>
                        {overdue && (
                          <span className="text-[10px] font-bold text-red-400 bg-red-900/30 border border-red-700/40 px-1.5 py-0.5 rounded">OVERDUE</span>
                        )}
                        {needsDailyReminder && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-300 bg-red-950/50 border border-red-800/50 px-1.5 py-0.5 rounded">
                            <Bell className="w-2.5 h-2.5" />Daily reminder due
                          </span>
                        )}
                      </div>

                      {/* Trustee + dates row */}
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500 mb-2">
                        {trustee && <span>{trustee.name}</span>}
                        {state && <span>{state.abbreviation}</span>}
                        {ch && <span className={`font-bold px-1 py-0.5 rounded border text-[9px] ${CHAPTER_COLORS[ch.code] ?? ''}`}>{ch.name}</span>}
                        {req.hearing_341_date && (
                          <span className={`flex items-center gap-1 font-medium ${
                            daysTo341 !== null && daysTo341 <= 7 ? 'text-red-400' :
                            daysTo341 !== null && daysTo341 <= 14 ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            <Calendar className="w-3 h-3" />
                            341: {new Date(req.hearing_341_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                            {daysTo341 !== null && ` (${daysTo341 < 0 ? `${Math.abs(daysTo341)}d ago` : daysTo341 === 0 ? 'TODAY' : `${daysTo341}d`})`}
                          </span>
                        )}
                        {req.doc_due_date && (
                          <span className={`flex items-center gap-1 ${overdue ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                            <Clock className="w-3 h-3" />
                            Docs: {new Date(req.doc_due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                            {overdue && ` (${Math.abs(daysToDue!)}d overdue)`}
                          </span>
                        )}
                      </div>

                      {/* Missing docs */}
                      {neededItems.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[11px] font-semibold text-red-400 mb-1">
                            {neededItems.length} Missing Document{neededItems.length !== 1 ? 's' : ''}:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {neededItems.map(item => (
                              <span
                                key={item.id}
                                className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                                  item.status === 'rejected'
                                    ? 'text-red-300 bg-red-900/30 border-red-700/40'
                                    : 'text-amber-300 bg-amber-900/20 border-amber-800/40'
                                }`}
                              >
                                {item.status === 'rejected' && <AlertCircle className="w-2.5 h-2.5" />}
                                {item.document_name}
                                {item.required && <span className="opacity-70">*</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Progress bar */}
                      {items.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${approvedItems.length >= items.length ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${Math.round((approvedItems.length / items.length) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-500 flex-shrink-0">{approvedItems.length}/{items.length} docs</span>
                        </div>
                      )}

                      {/* Last follow-up */}
                      {req.last_followup_at && (
                        <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
                          {req.last_followup_type === 'auto' ? <Bell className="w-3 h-3 text-teal-600" /> : <Send className="w-3 h-3 text-amber-600" />}
                          Last follow-up: {new Date(req.last_followup_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · {req.followup_count} sent
                        </p>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => sendFollowup(req)}
                        disabled={sendingId === req.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                          needsDailyReminder
                            ? 'bg-red-700 hover:bg-red-600 text-white border border-red-500'
                            : 'bg-amber-600/20 border border-amber-600/30 text-amber-400 hover:bg-amber-600/30'
                        } disabled:opacity-40`}
                      >
                        {sendingId === req.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {needsDailyReminder ? 'Send Daily Reminder' : 'Follow-up'}
                      </button>
                      {req.client_email && (
                        <a
                          href={`mailto:${req.client_email}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-slate-400 border border-slate-700/40 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <Mail className="w-3 h-3" />Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Paralegal Review Panel ───────────────────────────────────────────────────

function ParalegalReviewPanel() {
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [reviews, setReviews] = useState<Record<string, ParalegalReview>>({});
  const [reviewItems, setReviewItems] = useState<Record<string, ParalegalReviewItem[]>>({});
  const [requestItems, setRequestItems] = useState<Record<string, RequestItem[]>>({});
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [states, setStates] = useState<TrusteeState[]>([]);
  const [chapters, setChapters] = useState<ChapterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState('');
  const [filter, setFilter] = useState<'ready' | 'in_review' | 'approved' | 'all'>('ready');

  const load = useCallback(async () => {
    setLoading(true);
    const [reqs, trs, sts, chs, revs] = await Promise.all([
      sbGet<DocRequest>('trustee_document_requests?status=not.in.(closed)&order=hearing_341_date.asc'),
      sbGet<Trustee>('trustees?order=name.asc'),
      sbGet<TrusteeState>('trustee_states?order=name.asc'),
      sbGet<ChapterType>('trustee_chapter_types?order=sort_order.asc'),
      sbGet<ParalegalReview>('trustee_paralegal_reviews?order=created_at.desc'),
    ]);
    setRequests(reqs);
    setTrustees(trs);
    setStates(sts);
    setChapters(chs);
    const revMap: Record<string, ParalegalReview> = {};
    revs.forEach(r => { revMap[r.request_id] = r; });
    setReviews(revMap);
    // Load items
    const itemMap: Record<string, RequestItem[]> = {};
    await Promise.all(reqs.map(async r => {
      const items = await sbGet<RequestItem>(`trustee_request_items?request_id=eq.${r.id}&order=document_name.asc`);
      itemMap[r.id] = items;
    }));
    setRequestItems(itemMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function isAllSubmitted(reqId: string) {
    const items = requestItems[reqId] ?? [];
    const required = items.filter(i => i.required);
    return required.length > 0 && required.every(i => i.status === 'approved' || i.status === 'uploaded' || i.status === 'waived');
  }

  async function startReview(req: DocRequest) {
    const now = new Date().toISOString();
    const review = await sbPost<ParalegalReview>('trustee_paralegal_reviews', {
      request_id: req.id,
      trustee_id: req.trustee_id,
      status: 'in_review',
      assigned_to: 'Paralegal',
      review_started_at: now,
    });
    if (!review) return;
    const items = requestItems[req.id] ?? [];
    const reviewItemPayloads = items
      .filter(i => i.status === 'uploaded' || i.status === 'approved')
      .map(i => ({
        review_id: review.id,
        request_item_id: i.id,
        document_name: i.document_name,
        status: 'pending',
      }));
    const created: ParalegalReviewItem[] = [];
    for (const p of reviewItemPayloads) {
      const ri = await sbPost<ParalegalReviewItem>('trustee_paralegal_review_items', p);
      if (ri) created.push(ri);
    }
    setReviews(prev => ({ ...prev, [req.id]: review }));
    setReviewItems(prev => ({ ...prev, [review.id]: created }));
    await sbPatch('trustee_document_requests', req.id, { paralegal_review_status: 'in_review' });
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, paralegal_review_status: 'in_review' } : r));
    setExpanded(prev => new Set([...prev, req.id]));
  }

  async function confirmReviewItem(reviewId: string, itemId: string, status: 'confirmed' | 'needs_correction') {
    await sbPatch('trustee_paralegal_review_items', itemId, {
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
    });
    const items = await sbGet<ParalegalReviewItem>(`trustee_paralegal_review_items?review_id=eq.${reviewId}&order=document_name.asc`);
    setReviewItems(prev => ({ ...prev, [reviewId]: items }));
  }

  async function approveReview(req: DocRequest, review: ParalegalReview) {
    const now = new Date().toISOString();
    await sbPatch('trustee_paralegal_reviews', review.id, {
      status: 'approved', reviewed_by: 'Paralegal', review_completed_at: now,
    });
    await sbPatch('trustee_document_requests', req.id, {
      paralegal_review_status: 'approved', paralegal_reviewed_by: 'Paralegal',
    });
    setReviews(prev => ({ ...prev, [req.id]: { ...review, status: 'approved' } }));
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, paralegal_review_status: 'approved' } : r));
  }

  async function submitToTrustee(req: DocRequest) {
    if (!confirm(`Submit all documents for ${req.client_name} to the trustee portal? This will log the submission.`)) return;
    setSubmitting(req.id);
    const now = new Date().toISOString();
    const items = requestItems[req.id] ?? [];
    const docs = items.filter(i => i.status === 'approved' || i.status === 'uploaded').map(i => i.document_name);
    await sbPost<PortalSubmission>('trustee_portal_submissions', {
      request_id: req.id,
      trustee_id: req.trustee_id,
      submitted_by: 'Staff',
      method: 'manual',
      status: 'sent',
      documents_included: docs,
      notes: `${docs.length} documents submitted to trustee portal.`,
    });
    await sbPatch('trustee_document_requests', req.id, {
      submitted_to_trustee_at: now,
      status: 'complete',
    });
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'complete', submitted_to_trustee_at: now } : r));
    setSubmitting('');
  }

  // Categorize
  const readyForReview = requests.filter(r => isAllSubmitted(r.id) && !reviews[r.id]);
  const inReview = requests.filter(r => reviews[r.id]?.status === 'in_review');
  const approved = requests.filter(r => reviews[r.id]?.status === 'approved' && !r.submitted_to_trustee_at);
  const submitted = requests.filter(r => r.submitted_to_trustee_at);

  const displayList = filter === 'ready' ? readyForReview
    : filter === 'in_review' ? inReview
    : filter === 'approved' ? approved
    : [...readyForReview, ...inReview, ...approved, ...submitted];

  const REVIEW_STATUS = {
    pending:           { label: 'Pending', color: 'text-slate-400 bg-slate-800/40 border-slate-700/40' },
    in_review:         { label: 'In Review', color: 'text-sky-400 bg-sky-900/30 border-sky-700/40' },
    approved:          { label: 'Approved', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40' },
    needs_correction:  { label: 'Needs Fix', color: 'text-red-400 bg-red-900/30 border-red-700/40' },
  };

  async function loadReviewItems(reviewId: string) {
    if (reviewItems[reviewId]) return;
    const items = await sbGet<ParalegalReviewItem>(`trustee_paralegal_review_items?review_id=eq.${reviewId}&order=document_name.asc`);
    setReviewItems(prev => ({ ...prev, [reviewId]: items }));
  }

  function toggleExpanded(id: string, review?: ParalegalReview) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else {
        n.add(id);
        if (review) loadReviewItems(review.id);
      }
      return n;
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800/60 flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white">Paralegal Review Queue</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{readyForReview.length} ready · {inReview.length} in review · {approved.length} pending submission · {submitted.length} submitted</p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          {([
            { key: 'ready', label: `Ready (${readyForReview.length})` },
            { key: 'in_review', label: `In Review (${inReview.length})` },
            { key: 'approved', label: `Approved (${approved.length})` },
            { key: 'all', label: 'All' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.key ? 'bg-sky-700 text-white' : 'text-slate-500 hover:text-white'
              }`}
            >{f.label}</button>
          ))}
        </div>
        <button onClick={load} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 text-slate-600 animate-spin" /></div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nothing in this queue.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {displayList.map(req => {
              const items = requestItems[req.id] ?? [];
              const review = reviews[req.id];
              const rItems = review ? (reviewItems[review.id] ?? []) : [];
              const isExpanded = expanded.has(req.id);
              const trustee = trustees.find(t => t.id === req.trustee_id);
              const ch = chapters.find(c => c.id === trustee?.chapter_type_id);
              const state = states.find(s => s.id === trustee?.state_id);
              const daysTo341 = req.hearing_341_date
                ? Math.ceil((new Date(req.hearing_341_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
                : null;
              const allConfirmed = rItems.length > 0 && rItems.every(i => i.status === 'confirmed' || i.status === 'waived');
              const reviewSt = review ? (REVIEW_STATUS[review.status as keyof typeof REVIEW_STATUS] ?? REVIEW_STATUS.pending) : null;

              return (
                <div key={req.id} className="border-l-2 border-transparent hover:border-sky-700/50 transition-colors">
                  <button
                    onClick={() => toggleExpanded(req.id, review)}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-slate-800/20 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-white">{req.client_name}</p>
                        {req.case_number && <span className="text-[10px] text-slate-500 font-mono">{req.case_number}</span>}
                        {reviewSt && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${reviewSt.color}`}>{reviewSt.label}</span>}
                        {req.submitted_to_trustee_at && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/25 border border-emerald-700/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />Submitted to Trustee
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                        {trustee && <span>{trustee.name}</span>}
                        {state && <span>{state.abbreviation}</span>}
                        {ch && <span className={`font-bold px-1 py-0.5 rounded border text-[9px] ${CHAPTER_COLORS[ch.code] ?? ''}`}>{ch.name}</span>}
                        {req.hearing_341_date && daysTo341 !== null && (
                          <span className={`flex items-center gap-1 ${daysTo341 <= 7 ? 'text-red-400 font-semibold' : daysTo341 <= 14 ? 'text-amber-400' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" />341 in {daysTo341}d
                          </span>
                        )}
                        <span className="text-slate-600">{items.filter(i => i.status === 'approved' || i.status === 'uploaded').length}/{items.length} docs ready</span>
                      </div>
                    </div>
                    {/* Action button on right */}
                    {!review && !req.submitted_to_trustee_at && (
                      <button
                        onClick={e => { e.stopPropagation(); startReview(req); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600/20 border border-sky-600/30 text-sky-400 hover:bg-sky-600/30 transition-colors flex-shrink-0"
                      >
                        <User className="w-3 h-3" />Start Review
                      </button>
                    )}
                    {review?.status === 'approved' && !req.submitted_to_trustee_at && (
                      <button
                        onClick={e => { e.stopPropagation(); submitToTrustee(req); }}
                        disabled={submitting === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors flex-shrink-0 disabled:opacity-40"
                      >
                        {submitting === req.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Submit to Trustee
                      </button>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-800/60 bg-slate-900/20 px-5 py-3">
                      {/* All request items */}
                      <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">Documents</p>
                      <div className="space-y-1.5 mb-4">
                        {items.map(item => {
                          const ist = REQ_STATUS[item.status] ?? REQ_STATUS.needed;
                          const rItem = rItems.find(ri => ri.request_item_id === item.id);
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/30 border border-slate-700/30">
                              <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${ist.color}`}>
                                {ist.icon}{ist.label}
                              </span>
                              <span className="text-xs text-slate-300 flex-1">{item.document_name}</span>
                              {item.required && <span className="text-[10px] text-red-400 flex-shrink-0">REQ</span>}
                              {item.submitted_at && (
                                <span className="text-[10px] text-slate-600 flex-shrink-0">
                                  {new Date(item.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                                </span>
                              )}
                              {/* Paralegal confirm buttons */}
                              {review?.status === 'in_review' && (item.status === 'uploaded' || item.status === 'approved') && (
                                <div className="flex gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => confirmReviewItem(review.id, rItem?.id ?? '', 'confirmed')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                      rItem?.status === 'confirmed'
                                        ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-400'
                                        : 'border-slate-700/40 text-slate-500 hover:text-emerald-400'
                                    }`}
                                  >
                                    {rItem?.status === 'confirmed' ? <Check className="w-3 h-3" /> : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => confirmReviewItem(review.id, rItem?.id ?? '', 'needs_correction')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                      rItem?.status === 'needs_correction'
                                        ? 'bg-red-900/40 border-red-700/50 text-red-400'
                                        : 'border-slate-700/40 text-slate-500 hover:text-red-400'
                                    }`}
                                  >Fix</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Approve review button */}
                      {review?.status === 'in_review' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveReview(req, review)}
                            disabled={!allConfirmed}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {allConfirmed ? 'Approve & Mark Ready for Submission' : `Confirm all documents first (${rItems.filter(i => i.status === 'confirmed').length}/${rItems.length})`}
                          </button>
                        </div>
                      )}

                      {/* Submitted info */}
                      {req.submitted_to_trustee_at && (
                        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/15 border border-emerald-800/40 rounded-xl px-3 py-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          Submitted to trustee portal on {new Date(req.submitted_to_trustee_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Trustee API Config Panel ─────────────────────────────────────────────────

function ApiConfigPanel() {
  const [configs, setConfigs] = useState<TrusteeApiConfig[]>([]);
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [states, setStates] = useState<TrusteeState[]>([]);
  const [chapters, setChapters] = useState<ChapterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TrusteeApiConfig>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      sbGet<TrusteeApiConfig>('trustee_api_configs?order=portal_name.asc'),
      sbGet<Trustee>('trustees?order=name.asc'),
      sbGet<TrusteeState>('trustee_states?order=name.asc'),
      sbGet<ChapterType>('trustee_chapter_types?order=sort_order.asc'),
    ]).then(([cfgs, trs, sts, chs]) => {
      setConfigs(cfgs);
      setTrustees(trs);
      setStates(sts);
      setChapters(chs);
      setLoading(false);
    });
  }, []);

  async function saveConfig(config: TrusteeApiConfig) {
    setSaving(true);
    await sbPatch('trustee_api_configs', config.id, {
      portal_name: editForm.portal_name ?? config.portal_name,
      portal_url: editForm.portal_url ?? config.portal_url,
      api_type: editForm.api_type ?? config.api_type,
      submission_email: editForm.submission_email ?? config.submission_email,
      api_endpoint: editForm.api_endpoint ?? config.api_endpoint,
      ecf_login: editForm.ecf_login ?? config.ecf_login,
      notes: editForm.notes ?? config.notes,
      enabled: editForm.enabled ?? config.enabled,
    });
    setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, ...editForm } : c));
    setEditing(null);
    setEditForm({});
    setSaving(false);
  }

  async function toggleEnabled(config: TrusteeApiConfig) {
    await sbPatch('trustee_api_configs', config.id, { enabled: !config.enabled });
    setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, enabled: !c.enabled } : c));
  }

  const API_TYPE_META: Record<string, { label: string; color: string; desc: string }> = {
    manual: { label: 'Manual Upload', color: 'text-slate-400 bg-slate-800/40 border-slate-700/40', desc: 'Upload documents manually through trustee web portal' },
    email:  { label: 'Email Submission', color: 'text-sky-400 bg-sky-900/30 border-sky-700/40', desc: 'Documents sent via email to trustee submission address' },
    rest:   { label: 'REST API', color: 'text-teal-400 bg-teal-900/30 border-teal-700/40', desc: 'Direct API integration with trustee document portal' },
    ecf:    { label: 'ECF Filing', color: 'text-amber-400 bg-amber-900/30 border-amber-700/40', desc: 'Electronic Court Filing system integration' },
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/60">
        <h3 className="text-sm font-bold text-white">Trustee Portal API Configuration</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Configure document submission methods for each trustee's portal</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 text-slate-600 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {configs.map(config => {
              const trustee = trustees.find(t => t.id === config.trustee_id);
              const ch = chapters.find(c => c.id === trustee?.chapter_type_id);
              const state = states.find(s => s.id === trustee?.state_id);
              const typeMeta = API_TYPE_META[config.api_type] ?? API_TYPE_META.manual;
              const isEditing = editing === config.id;

              return (
                <div key={config.id} className={`rounded-2xl border ${config.enabled ? 'border-slate-700/50' : 'border-slate-800/40'} overflow-hidden`}>
                  {/* Config header */}
                  <div className={`flex items-center gap-3 px-4 py-3 ${config.enabled ? 'bg-slate-800/30' : 'bg-slate-900/20'}`}>
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                      config.enabled ? 'bg-emerald-900/30 border-emerald-700/40' : 'bg-slate-800/50 border-slate-700/40'
                    }`}>
                      <Scale className={`w-4 h-4 ${config.enabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{config.portal_name}</p>
                        {state && <span className="text-[10px] text-slate-500">{state.abbreviation}</span>}
                        {ch && <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${CHAPTER_COLORS[ch.code] ?? ''}`}>{ch.name}</span>}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeMeta.color}`}>{typeMeta.label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          config.enabled
                            ? 'text-emerald-400 bg-emerald-900/25 border-emerald-700/40'
                            : 'text-slate-500 bg-slate-800/40 border-slate-700/40'
                        }`}>{config.enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{typeMeta.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleEnabled(config)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                          config.enabled
                            ? 'text-slate-400 border-slate-700/40 hover:text-red-400'
                            : 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40 hover:bg-emerald-900/30'
                        }`}
                      >{config.enabled ? 'Disable' : 'Enable'}</button>
                      <button
                        onClick={() => { setEditing(isEditing ? null : config.id); setEditForm({ ...config }); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        {isEditing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Config details / edit form */}
                  {isEditing ? (
                    <div className="px-4 py-3 border-t border-slate-800/60 bg-slate-900/30 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className={lbl}>Portal Name</label>
                          <input className={inp} value={editForm.portal_name ?? ''} onChange={e => setEditForm(f => ({ ...f, portal_name: e.target.value }))} />
                        </div>
                        <div>
                          <label className={lbl}>Submission Method</label>
                          <select className={inp} value={editForm.api_type ?? 'manual'} onChange={e => setEditForm(f => ({ ...f, api_type: e.target.value }))}>
                            <option value="manual">Manual Upload</option>
                            <option value="email">Email Submission</option>
                            <option value="rest">REST API</option>
                            <option value="ecf">ECF Filing</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Portal URL</label>
                          <input className={inp} value={editForm.portal_url ?? ''} onChange={e => setEditForm(f => ({ ...f, portal_url: e.target.value }))} placeholder="https://..." />
                        </div>
                        {(editForm.api_type === 'email' || editForm.api_type === 'manual') && (
                          <div className="col-span-2">
                            <label className={lbl}>Submission Email</label>
                            <input className={inp} value={editForm.submission_email ?? ''} onChange={e => setEditForm(f => ({ ...f, submission_email: e.target.value }))} placeholder="trustee@example.com" />
                          </div>
                        )}
                        {editForm.api_type === 'rest' && (
                          <div className="col-span-2">
                            <label className={lbl}>API Endpoint</label>
                            <input className={inp} value={editForm.api_endpoint ?? ''} onChange={e => setEditForm(f => ({ ...f, api_endpoint: e.target.value }))} placeholder="https://api.trustee.com/submit" />
                          </div>
                        )}
                        {editForm.api_type === 'ecf' && (
                          <div className="col-span-2">
                            <label className={lbl}>ECF Login / Filer ID</label>
                            <input className={inp} value={editForm.ecf_login ?? ''} onChange={e => setEditForm(f => ({ ...f, ecf_login: e.target.value }))} placeholder="ECF username or filer ID" />
                          </div>
                        )}
                        <div className="col-span-2">
                          <label className={lbl}>Notes</label>
                          <textarea className={`${inp} resize-none`} rows={2} value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(null); setEditForm({}); }} className="flex-1 px-3 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors">Cancel</button>
                        <button
                          onClick={() => saveConfig(config)}
                          disabled={saving}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50"
                        >
                          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 border-t border-slate-800/40 flex flex-wrap gap-4 text-[11px] text-slate-500">
                      {config.submission_email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{config.submission_email}</span>
                      )}
                      {config.portal_url && (
                        <a href={config.portal_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-500 hover:text-sky-400 transition-colors">
                          <ExternalLink className="w-3 h-3" />{config.portal_url}
                        </a>
                      )}
                      {config.api_endpoint && (
                        <span className="flex items-center gap-1 font-mono text-teal-500"><FileText className="w-3 h-3" />{config.api_endpoint}</span>
                      )}
                      {config.notes && <span className="w-full text-slate-600 italic">{config.notes}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────────

export default function TrusteeDocumentPortal() {
  const [mode, setMode] = useState<'trustees' | 'calendar' | 'tasks' | 'paralegal' | 'api' | 'firm_trustees'>('tasks');
  const [states, setStates] = useState<TrusteeState[]>([]);
  const [chapters, setChapters] = useState<ChapterType[]>([]);
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedTrusteeId, setSelectedTrusteeId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showAddTrustee, setShowAddTrustee] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [sts, chs, trs, cats] = await Promise.all([
      sbGet<TrusteeState>('trustee_states?order=name.asc'),
      sbGet<ChapterType>('trustee_chapter_types?order=sort_order.asc'),
      sbGet<Trustee>('trustees?order=name.asc'),
      sbGet<DocCategory>('trustee_document_categories?order=sort_order.asc'),
    ]);
    setStates(sts);
    setChapters(chs);
    setTrustees(trs);
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Filtered trustees
  const filteredTrustees = trustees.filter(t => {
    if (!showInactive && !t.active) return false;
    if (selectedStateId && t.state_id !== selectedStateId) return false;
    if (selectedChapterId && t.chapter_type_id !== selectedChapterId) return false;
    if (search) {
      const q = search.toLowerCase();
      const st = states.find(s => s.id === t.state_id);
      const ch = chapters.find(c => c.id === t.chapter_type_id);
      return (
        t.name.toLowerCase().includes(q) ||
        (t.district ?? '').toLowerCase().includes(q) ||
        (st?.name ?? '').toLowerCase().includes(q) ||
        (ch?.name ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by state → chapter
  const grouped = filteredTrustees.reduce<Record<string, Record<string, Trustee[]>>>((acc, t) => {
    const st = states.find(s => s.id === t.state_id);
    const ch = chapters.find(c => c.id === t.chapter_type_id);
    if (!st || !ch) return acc;
    acc[st.id] = acc[st.id] ?? {};
    acc[st.id][ch.id] = acc[st.id][ch.id] ?? [];
    acc[st.id][ch.id].push(t);
    return acc;
  }, {});

  const selectedTrustee = trustees.find(t => t.id === selectedTrusteeId) ?? null;

  const activeStates = states.filter(s => Object.keys(grouped).includes(s.id));

  const NAV_TABS = [
    { key: 'tasks',         label: 'Task List',       icon: <AlertCircle className="w-3 h-3" />,    activeClass: 'bg-red-700 text-white' },
    { key: 'calendar',      label: 'Calendar',        icon: <Calendar className="w-3 h-3" />,       activeClass: 'bg-sky-700 text-white' },
    { key: 'paralegal',     label: 'Review Queue',    icon: <User className="w-3 h-3" />,           activeClass: 'bg-teal-700 text-white' },
    { key: 'trustees',      label: 'Trustees',        icon: <Scale className="w-3 h-3" />,          activeClass: 'bg-slate-700 text-white' },
    { key: 'firm_trustees', label: 'Firm Trustees',   icon: <Scale className="w-3 h-3" />,          activeClass: 'bg-amber-500 text-slate-950' },
    { key: 'checklist',     label: '341 Checklist',   icon: <ClipboardList className="w-3 h-3" />,  activeClass: 'bg-emerald-700 text-white' },
    { key: 'api',           label: 'API Config',      icon: <FileText className="w-3 h-3" />,       activeClass: 'bg-slate-700 text-white' },
  ] as const;

  return (
    <div className="h-screen flex flex-col bg-[#080e1c] overflow-hidden">
      {/* Top header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60 bg-[#090f1d] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
            <Scale className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Trustee Document Portal</h1>
            <p className="text-[11px] text-slate-500">341 hearings · tasks · paralegal review · submission</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Nav tabs */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-800/70 border border-slate-700/50 gap-0.5">
            {NAV_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mode === tab.key ? tab.activeClass : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
          {mode === 'trustees' && (
            <>
              <button
                onClick={() => setShowInactive(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showInactive ? 'text-slate-300 bg-slate-800 border-slate-600' : 'text-slate-500 border-slate-700/50 hover:text-slate-300'}`}
              >
                {showInactive ? 'Hide Inactive' : 'Show Inactive'}
              </button>
              <button
                onClick={() => setShowAddTrustee(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600/20 border border-sky-600/30 text-sky-400 hover:bg-sky-600/30 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Trustee
              </button>
            </>
          )}
          <button onClick={loadAll} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Full-width panels */}
      {mode === 'calendar'      && <CalendarPanel />}
      {mode === 'tasks'         && <TaskListPanel />}
      {mode === 'paralegal'     && <ParalegalReviewPanel />}
      {mode === 'api'           && <ApiConfigPanel />}
      {mode === 'firm_trustees' && (
        <div className="flex-1 overflow-y-auto p-5">
          <FirmTrusteesPanel />
        </div>
      )}
      {mode === 'checklist' && <ChecklistConfigPanel firmId={V1_DEFAULT_FIRM_ID} />}

      <div className={`flex flex-1 min-h-0 ${mode !== 'trustees' ? 'hidden' : ''}`}>
        {/* Left sidebar — state/chapter/trustee tree */}
        <div className="w-72 flex-shrink-0 border-r border-slate-800/60 flex flex-col bg-[#090f1d]">
          {/* Search + filters */}
          <div className="p-3 space-y-2 border-b border-slate-800/60">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                className="w-full bg-slate-800/50 border border-slate-700/50 text-white text-xs rounded-xl pl-8 pr-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
                placeholder="Search trustees…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
                  value={selectedStateId}
                  onChange={e => { setSelectedStateId(e.target.value); setSelectedChapterId(''); setSelectedTrusteeId(''); }}
                >
                  <option value="">All States</option>
                  {activeStates.map(s => <option key={s.id} value={s.id}>{s.abbreviation} — {s.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <select
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
                  value={selectedChapterId}
                  onChange={e => { setSelectedChapterId(e.target.value); setSelectedTrusteeId(''); }}
                >
                  <option value="">All Chapters</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
              </div>
            ) : activeStates.length === 0 ? (
              <div className="text-center py-10 text-slate-600 px-4">
                <Building2 className="w-7 h-7 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No trustees found.</p>
              </div>
            ) : (
              activeStates.map(state => {
                const stateGroups = grouped[state.id] ?? {};
                const stateChapters = chapters.filter(c => stateGroups[c.id]);
                return (
                  <StateSection
                    key={state.id}
                    state={state}
                    chapters={stateChapters}
                    allChapters={chapters}
                    grouped={stateGroups}
                    selectedTrusteeId={selectedTrusteeId}
                    onSelectTrustee={setSelectedTrusteeId}
                    defaultOpen={!selectedStateId || selectedStateId === state.id}
                  />
                );
              })
            )}
          </div>

          {/* Footer stats */}
          <div className="px-3 py-2.5 border-t border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-600">
            <List className="w-3 h-3" />
            <span>{trustees.filter(t => t.active).length} active trustee{trustees.filter(t => t.active).length !== 1 ? 's' : ''} across {activeStates.length} state{activeStates.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedTrustee ? (
            <TrusteeDetailPanel
              key={selectedTrustee.id}
              trustee={selectedTrustee}
              states={states}
              chapters={chapters}
              categories={categories}
              onUpdate={loadAll}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center">
                <Scale className="w-8 h-8 opacity-30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Select a trustee</p>
                <p className="text-xs mt-1 text-slate-700">Choose a trustee from the left panel to view<br />document requirements and client requests.</p>
              </div>
              {trustees.length === 0 && !loading && (
                <button
                  onClick={() => setShowAddTrustee(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600/20 border border-sky-600/30 text-sky-400 hover:bg-sky-600/30 transition-colors mt-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Add your first trustee
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddTrustee && (
        <TrusteeModal
          trustee={null}
          states={states}
          chapters={chapters}
          onSave={saved => {
            setTrustees(prev => [...prev, saved]);
            setSelectedTrusteeId(saved.id);
            setShowAddTrustee(false);
          }}
          onClose={() => setShowAddTrustee(false)}
        />
      )}
    </div>
  );
}

// ─── State Section (collapsible) ──────────────────────────────────────────────

function StateSection({
  state, chapters, allChapters, grouped, selectedTrusteeId, onSelectTrustee, defaultOpen,
}: {
  state: TrusteeState;
  chapters: ChapterType[];
  allChapters: ChapterType[];
  grouped: Record<string, Trustee[]>;
  selectedTrusteeId: string;
  onSelectTrustee: (id: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-800/40 last:border-b-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-800/30 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
        <MapPin className="w-3 h-3 text-slate-500" />
        <span className="text-xs font-bold text-slate-300 flex-1">{state.abbreviation} — {state.name}</span>
        <span className="text-[10px] text-slate-600">{Object.values(grouped).flat().length}</span>
      </button>
      {open && chapters.map(ch => {
        const trusteeList = grouped[ch.id] ?? [];
        return (
          <ChapterSection
            key={ch.id}
            chapter={ch}
            trustees={trusteeList}
            selectedTrusteeId={selectedTrusteeId}
            onSelectTrustee={onSelectTrustee}
          />
        );
      })}
    </div>
  );
}

// ─── Chapter Section ──────────────────────────────────────────────────────────

function ChapterSection({
  chapter, trustees, selectedTrusteeId, onSelectTrustee,
}: {
  chapter: ChapterType;
  trustees: Trustee[];
  selectedTrusteeId: string;
  onSelectTrustee: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="ml-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/20 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 text-slate-600" /> : <ChevronRight className="w-3 h-3 text-slate-600" />}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CHAPTER_COLORS[chapter.code] ?? 'text-slate-500 bg-slate-800/40 border-slate-700'}`}>
          {chapter.name}
        </span>
        <span className="text-[11px] text-slate-500 flex-1 truncate">{chapter.description}</span>
        <span className="text-[10px] text-slate-600">{trustees.length}</span>
      </button>
      {open && (
        <div className="ml-3 space-y-0.5 pb-1">
          {trustees.map(t => (
            <button
              key={t.id}
              onClick={() => onSelectTrustee(t.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all ${
                selectedTrusteeId === t.id
                  ? 'bg-sky-900/30 border border-sky-700/40 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{t.name}</p>
                {t.district && <p className="text-[10px] text-slate-600 truncate">{t.district}</p>}
              </div>
              {selectedTrusteeId === t.id && <Check className="w-3 h-3 text-sky-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
