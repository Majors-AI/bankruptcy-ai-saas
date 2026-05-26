import { useState, useEffect, useCallback } from "react";
import {
  Inbox, Plus, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Save, Send, Trash2, RefreshCw, Search, Filter, Eye, X, Copy,
  BookOpen, ClipboardList, Zap, CheckSquare, Circle, ArrowRight,
  FileText, Gavel, User, Scale, Flag, Tag, Download,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json().catch(() => null);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EcfEntry {
  id: string;
  client_id: string | null;
  case_number: string;
  docket_entry: string;
  filing_type: string;
  filed_by: string;
  filed_date: string;
  deadline_days: number;
  status: string;
  created_at: string;
}

interface PleadingTemplate {
  id: string;
  name: string;
  category: string;
  applicable_filing_type: string | null;
  content_template: string;
  created_at: string;
}

interface PleadingDraft {
  id: string;
  client_id: string | null;
  template_id: string | null;
  ecf_inbox_id: string | null;
  case_number: string;
  title: string;
  content: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface EcfTask {
  id: string;
  ecf_inbox_id: string;
  client_id: string | null;
  rule_id: string | null;
  title: string;
  due_date: string | null;
  priority: string;
  assigned_to: string;
  status: string;
  calendar_event_created: boolean;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILING_TYPE_LABELS: Record<string, string> = {
  motion_for_relief: "Motion for Relief",
  objection_to_plan: "Objection to Plan",
  trustee_motion: "Trustee Motion",
  notice_of_default: "Notice of Default",
  order_to_show_cause: "Order to Show Cause",
  creditor_objection: "Creditor Objection",
  change_of_address: "Change of Address",
  claim_objection: "Claim Objection",
  motion_to_dismiss: "Motion to Dismiss",
  plan_confirmation: "Plan Confirmation",
  notice_of_conversion: "Notice of Conversion",
  motion_to_convert: "Motion to Convert",
  voluntary_dismissal: "Voluntary Dismissal",
  lien_avoidance: "Lien Avoidance",
  motion_to_value: "Motion to Value",
  general: "General",
};

const PRIORITY_CFG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  high:   { label: "High",   bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/25",    dot: "bg-red-400" },
  medium: { label: "Medium", bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/25",  dot: "bg-amber-400" },
  low:    { label: "Low",    bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25", dot: "bg-emerald-400" },
};

const STATUS_CFG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  pending:      { label: "Pending",      text: "text-amber-400",  bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  task_created: { label: "Task Created", text: "text-sky-400",    bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  responded:    { label: "Responded",    text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  dismissed:    { label: "Dismissed",    text: "text-slate-400",  bg: "bg-slate-700/20",   border: "border-slate-700/40" },
  draft:        { label: "Draft",        text: "text-amber-400",  bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  under_review: { label: "Under Review", text: "text-sky-400",    bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  filed:        { label: "Filed",        text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  archived:     { label: "Archived",     text: "text-slate-400",  bg: "bg-slate-700/20",   border: "border-slate-700/40" },
  open:         { label: "Open",         text: "text-amber-400",  bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  in_progress:  { label: "In Progress",  text: "text-sky-400",    bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  completed:    { label: "Completed",    text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
};

const ATTORNEYS = ["All Attorneys", "Sarah Mitchell", "David Chen", "Jennifer Smith", "Michael Torres"];

function daysUntil(dateStr: string, deadlineDays: number) {
  const due = new Date(dateStr);
  due.setDate(due.getDate() + deadlineDays);
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.text} ${cfg.bg} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[priority] ?? PRIORITY_CFG.medium;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.text} ${cfg.bg} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Draft Editor Modal ───────────────────────────────────────────────────────

function DraftEditor({
  draft: initDraft,
  templates,
  onClose,
  onSaved,
}: {
  draft: PleadingDraft;
  templates: PleadingTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initDraft);
  const [saving, setSaving] = useState(false);

  async function save(newStatus?: string) {
    setSaving(true);
    await sbFetch(`pleading_drafts?id=eq.${draft.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: draft.content, title: draft.title, status: newStatus ?? draft.status, updated_at: new Date().toISOString() }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0a1120] border border-slate-700/60 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              className="bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-slate-600 pb-0.5 min-w-[200px]" />
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={draft.status} />
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
            <span>Case: <span className="text-slate-300 font-semibold">{draft.case_number}</span></span>
            <span>·</span>
            <span>Created: <span className="text-slate-300">{fmtDate(draft.created_at)}</span></span>
          </div>
          <textarea
            rows={18}
            value={draft.content}
            onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
            className="w-full bg-[#0d1626] border border-slate-700/60 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/50 resize-none font-mono leading-relaxed"
          />
        </div>
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-700/50 flex-wrap">
          <button onClick={() => save()} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={() => save("under_review")} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors disabled:opacity-50">
            <Send className="w-3.5 h-3.5" /> Submit for Review
          </button>
          <button onClick={() => save("filed")} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl transition-colors disabled:opacity-50">
            <CheckSquare className="w-3.5 h-3.5" /> Mark Filed
          </button>
          <button onClick={() => save("archived")} disabled={saving}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Archive
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Motion Draft Modal ─────────────────────────────────────────────────

function QuickMotionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const MOTIONS = [
    {
      type: "change_of_address",
      label: "Motion to Change Address",
      description: "Update debtor address in the matter before the court",
      template: (cn: string, name: string) =>
        `IN THE UNITED STATES BANKRUPTCY COURT\n\nIN RE: ${name || "[CLIENT NAME]"}\nCase No.: ${cn || "[CASE NUMBER]"}\n\nMOTION TO CHANGE ADDRESS\n\nComes now the Debtor, ${name || "[CLIENT NAME]"}, by and through undersigned counsel, and respectfully moves this Court to update the address of record as follows:\n\nNew Address: ___________________________\n\nThe Debtor respectfully requests that all future correspondence and notices be directed to the above address.\n\nRespectfully submitted,\n\n_______________________\nCounsel for Debtor\nDate: ${new Date().toLocaleDateString()}`,
    },
    {
      type: "motion_to_value",
      label: "Motion to Value Collateral",
      description: "Value secured creditor's collateral under 11 U.S.C. § 506",
      template: (cn: string, name: string) =>
        `IN THE UNITED STATES BANKRUPTCY COURT\n\nIN RE: ${name || "[CLIENT NAME]"}\nCase No.: ${cn || "[CASE NUMBER]"}\n\nMOTION TO VALUE COLLATERAL PURSUANT TO 11 U.S.C. § 506(a)\n\nComes now the Debtor, ${name || "[CLIENT NAME]"}, and moves this Court to value the collateral of [CREDITOR NAME] at $[VALUE], based on the fair market value of the property located at [ADDRESS/DESCRIPTION].\n\nThe Debtor requests that the secured claim be reduced to the value of the collateral.\n\nRespectfully submitted,\n\n_______________________\nCounsel for Debtor\nDate: ${new Date().toLocaleDateString()}`,
    },
    {
      type: "motion_to_convert",
      label: "Motion to Convert Case",
      description: "Convert Chapter 13 to Chapter 7 (or vice versa)",
      template: (cn: string, name: string) =>
        `IN THE UNITED STATES BANKRUPTCY COURT\n\nIN RE: ${name || "[CLIENT NAME]"}\nCase No.: ${cn || "[CASE NUMBER]"}\n\nMOTION TO CONVERT CASE FROM CHAPTER ___ TO CHAPTER ___\n\nComes now the Debtor, ${name || "[CLIENT NAME]"}, by and through counsel, and pursuant to 11 U.S.C. § 1307(a) moves this Court for an order converting this case.\n\nGrounds for conversion: [EXPLAIN REASON]\n\nRespectfully submitted,\n\n_______________________\nCounsel for Debtor\nDate: ${new Date().toLocaleDateString()}`,
    },
    {
      type: "lien_avoidance",
      label: "Motion to Avoid Judicial Lien",
      description: "Avoid a judicial lien impairing exemption under § 522(f)",
      template: (cn: string, name: string) =>
        `IN THE UNITED STATES BANKRUPTCY COURT\n\nIN RE: ${name || "[CLIENT NAME]"}\nCase No.: ${cn || "[CASE NUMBER]"}\n\nMOTION TO AVOID JUDICIAL LIEN PURSUANT TO 11 U.S.C. § 522(f)\n\nComes now the Debtor, ${name || "[CLIENT NAME]"}, and moves this Court to avoid the judicial lien held by [CREDITOR NAME], Judgment No. [JUDGMENT NUMBER], recorded on [DATE], in the amount of $[AMOUNT].\n\nThe lien impairs the Debtor's exemption in property located at [PROPERTY ADDRESS]. The Debtor is entitled to an exemption in the amount of $[EXEMPTION AMOUNT].\n\nRespectfully submitted,\n\n_______________________\nCounsel for Debtor\nDate: ${new Date().toLocaleDateString()}`,
    },
  ];

  const [step, setStep] = useState<"select" | "fill">("select");
  const [selected, setSelected] = useState<(typeof MOTIONS)[0] | null>(null);
  const [caseNumber, setCaseNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!selected) return;
    setSaving(true);
    await sbFetch("pleading_drafts", {
      method: "POST",
      body: JSON.stringify({
        case_number: caseNumber || "PENDING",
        title: selected.label,
        content: selected.template(caseNumber, clientName),
        status: "draft",
        created_by: "Staff",
      }),
    });
    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0a1120] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Draft a Motion</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {step === "select" && (
          <div className="p-5 space-y-2">
            <p className="text-xs text-slate-500 mb-3">Select a motion type — client info auto-populates from case number</p>
            {MOTIONS.map(m => (
              <button key={m.type} onClick={() => { setSelected(m); setStep("fill"); }}
                className="w-full text-left flex items-start gap-3 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 hover:border-amber-500/30 transition-all group">
                <FileText className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">{m.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 ml-auto flex-shrink-0 mt-0.5 transition-colors" />
              </button>
            ))}
          </div>
        )}

        {step === "fill" && selected && (
          <div className="p-5 space-y-4">
            <button onClick={() => setStep("select")} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              <ChevronDown className="w-3.5 h-3.5 rotate-90" /> Back
            </button>
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <FileText className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">{selected.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Case Number</label>
                <input value={caseNumber} onChange={e => setCaseNumber(e.target.value)}
                  placeholder="24-12345-BK"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Client Name</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              The motion will be created as a draft with client info pre-filled. You can edit the full content before filing.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 text-xs text-slate-400 border border-slate-700 rounded-xl hover:text-white transition-colors">Cancel</button>
              <button onClick={create} disabled={saving}
                className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl transition-colors disabled:opacity-50">
                {saving ? "Creating…" : "Create Draft"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add ECF Modal ────────────────────────────────────────────────────────────

function AddEcfModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    case_number: "",
    docket_entry: "",
    filing_type: "motion_for_relief",
    filed_by: "",
    filed_date: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.case_number || !form.docket_entry) return;
    setSaving(true);
    await sbFetch("ecf_inbox", { method: "POST", body: JSON.stringify(form) });
    onAdded();
    onClose();
    setSaving(false);
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0a1120] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Inbox className="w-4 h-4 text-sky-400" /> Add ECF Notice
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="Case Number">
              <input value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                placeholder="24-12345-BK" />
            </F>
            <F label="Filed Date">
              <input type="date" value={form.filed_date} onChange={e => setForm(f => ({ ...f, filed_date: e.target.value }))}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500" />
            </F>
          </div>
          <F label="Filing Type">
            <select value={form.filing_type} onChange={e => setForm(f => ({ ...f, filing_type: e.target.value }))}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500">
              {Object.entries(FILING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </F>
          <F label="Filed By (Creditor / Trustee / Court)">
            <input value={form.filed_by} onChange={e => setForm(f => ({ ...f, filed_by: e.target.value }))}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              placeholder="e.g. US Trustee, Chase Bank" />
          </F>
          <F label="Docket Entry Description">
            <textarea rows={3} value={form.docket_entry} onChange={e => setForm(f => ({ ...f, docket_entry: e.target.value }))}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              placeholder="Paste the full docket entry text…" />
          </F>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving || !form.case_number || !form.docket_entry}
            className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Add Notice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ECFNoticesPortal() {
  const [tab, setTab] = useState<"inbox" | "tasks" | "drafts" | "templates">("inbox");
  const [entries, setEntries] = useState<EcfEntry[]>([]);
  const [templates, setTemplates] = useState<PleadingTemplate[]>([]);
  const [drafts, setDrafts] = useState<PleadingDraft[]>([]);
  const [tasks, setTasks] = useState<EcfTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filingFilter, setFilingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [attorneyFilter, setAttorneyFilter] = useState("All Attorneys");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddEcf, setShowAddEcf] = useState(false);
  const [showMotion, setShowMotion] = useState(false);
  const [editDraft, setEditDraft] = useState<PleadingDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [e, t, d, tk] = await Promise.all([
      sbFetch("ecf_inbox?order=filed_date.desc&limit=200").catch(() => []),
      sbFetch("pleading_templates?order=created_at.desc&limit=100").catch(() => []),
      sbFetch("pleading_drafts?order=updated_at.desc&limit=200").catch(() => []),
      sbFetch("ecf_tasks?order=due_date.asc&limit=200").catch(() => []),
    ]);
    setEntries(e ?? []);
    setTemplates(t ?? []);
    setDrafts(d ?? []);
    setTasks(tk ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Prioritized ECF entries: overdue first, then high priority tasks, then deadline asc
  const sortedEntries = [...entries].sort((a, b) => {
    const da = daysUntil(a.filed_date, a.deadline_days ?? 21);
    const db = daysUntil(b.filed_date, b.deadline_days ?? 21);
    if (da < 0 && db >= 0) return -1;
    if (db < 0 && da >= 0) return 1;
    return da - db;
  });

  const filteredEntries = sortedEntries.filter(e => {
    if (search && !e.case_number.toLowerCase().includes(search.toLowerCase()) && !e.docket_entry.toLowerCase().includes(search.toLowerCase())) return false;
    if (filingFilter !== "all" && e.filing_type !== filingFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (attorneyFilter !== "All Attorneys" && t.assigned_to !== attorneyFilter) return false;
    return true;
  }).sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    const pa = p[a.priority as keyof typeof p] ?? 1;
    const pb = p[b.priority as keyof typeof p] ?? 1;
    if (pa !== pb) return pa - pb;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const overdueCount = entries.filter(e => daysUntil(e.filed_date, e.deadline_days ?? 21) < 0 && e.status !== "responded" && e.status !== "dismissed").length;
  const urgentCount = entries.filter(e => { const d = daysUntil(e.filed_date, e.deadline_days ?? 21); return d >= 0 && d <= 3 && e.status !== "responded" && e.status !== "dismissed"; }).length;
  const openTaskCount = tasks.filter(t => t.status !== "completed").length;
  const highPriorityTasks = tasks.filter(t => t.priority === "high" && t.status !== "completed").length;

  const TABS = [
    { id: "inbox" as const, label: "ECF Inbox", icon: <Inbox className="w-3.5 h-3.5" />, badge: overdueCount > 0 ? overdueCount : null, badgeColor: "bg-red-500" },
    { id: "tasks" as const, label: "Priority Tasks", icon: <ClipboardList className="w-3.5 h-3.5" />, badge: highPriorityTasks > 0 ? highPriorityTasks : null, badgeColor: "bg-red-500" },
    { id: "drafts" as const, label: "Drafts", icon: <FileText className="w-3.5 h-3.5" />, badge: drafts.filter(d => d.status === "under_review").length || null, badgeColor: "bg-amber-500" },
    { id: "templates" as const, label: "Templates", icon: <BookOpen className="w-3.5 h-3.5" />, badge: null, badgeColor: "" },
  ];

  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#050a14]/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <Inbox className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">ECF Notices</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Docket management · tasks · motions</p>
            </div>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-1.5">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-xs font-bold text-red-300">{overdueCount} Overdue</span>
            </div>
          )}
          {urgentCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/25 rounded-xl px-3 py-1.5">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">{urgentCount} Due Soon</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowMotion(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors">
              <Gavel className="w-3.5 h-3.5" /> Draft Motion
            </button>
            <button onClick={() => setShowAddEcf(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add ECF Notice
            </button>
            <button onClick={load} disabled={loading}
              className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Overdue Responses", val: overdueCount, icon: <AlertTriangle className="w-4 h-4 text-red-400" />, bg: "bg-red-500/8 border-red-500/20", vc: "text-red-400" },
            { label: "Due Within 3 Days", val: urgentCount, icon: <Clock className="w-4 h-4 text-amber-400" />, bg: "bg-amber-500/8 border-amber-500/20", vc: "text-amber-300" },
            { label: "Open Tasks", val: openTaskCount, icon: <ClipboardList className="w-4 h-4 text-sky-400" />, bg: "bg-sky-500/8 border-sky-500/20", vc: "text-sky-300" },
            { label: "Drafts in Review", val: drafts.filter(d => d.status === "under_review").length, icon: <FileText className="w-4 h-4 text-emerald-400" />, bg: "bg-emerald-500/8 border-emerald-500/20", vc: "text-emerald-300" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-2">{s.icon}<p className="text-[11px] text-slate-500">{s.label}</p></div>
              <p className={`text-2xl font-black ${s.vc}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                tab === t.id ? "text-white border-sky-400" : "text-slate-500 border-transparent hover:text-slate-300"
              }`}>
              {t.icon}{t.label}
              {t.badge != null && (
                <span className={`ml-0.5 text-[9px] font-black text-white rounded-full px-1.5 py-0.5 ${t.badgeColor}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── ECF INBOX ── */}
        {tab === "inbox" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search case number or entry…"
                  className="w-full bg-[#0b1220] border border-slate-800 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-sky-500/50" />
              </div>
              <select value={filingFilter} onChange={e => setFilingFilter(e.target.value)}
                className="bg-[#0b1220] border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500/50 appearance-none">
                <option value="all">All Filing Types</option>
                {Object.entries(FILING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#0b1220] border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500/50 appearance-none">
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="task_created">Task Created</option>
                <option value="responded">Responded</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            {/* Notice: sorted by urgency */}
            <p className="text-[10px] text-slate-600 px-1">Sorted by urgency — overdue first, then nearest deadline</p>

            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-800/30 rounded-2xl animate-pulse" />)}</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-16 bg-[#0b1220] border border-slate-800 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No ECF notices match your filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEntries.map(entry => {
                  const days = daysUntil(entry.filed_date, entry.deadline_days ?? 21);
                  const isOverdue = days < 0 && entry.status !== "responded" && entry.status !== "dismissed";
                  const isUrgent = days >= 0 && days <= 3 && entry.status !== "responded" && entry.status !== "dismissed";
                  const taskCount = tasks.filter(t => t.ecf_inbox_id === entry.id).length;
                  const expanded = expandedId === entry.id;

                  return (
                    <div key={entry.id} className={`rounded-2xl border overflow-hidden transition-all ${
                      isOverdue ? "bg-red-500/5 border-red-500/25" :
                      isUrgent ? "bg-amber-500/5 border-amber-500/20" :
                      "bg-[#0b1220] border-slate-800"
                    }`}>
                      <div className="flex items-center gap-4 px-5 py-3.5 cursor-pointer" onClick={() => setExpandedId(expanded ? null : entry.id)}>
                        {/* Urgency indicator */}
                        <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                          isOverdue ? "bg-red-500" :
                          isUrgent ? "bg-amber-400" :
                          entry.status === "responded" || entry.status === "dismissed" ? "bg-emerald-500/40" :
                          "bg-sky-500/40"
                        }`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-bold text-white">{entry.case_number}</span>
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 rounded-full px-1.5 py-0.5">
                              {FILING_TYPE_LABELS[entry.filing_type] ?? entry.filing_type}
                            </span>
                            <StatusBadge status={entry.status} />
                            {taskCount > 0 && (
                              <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-1.5 py-0.5">
                                {taskCount} task{taskCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">{entry.docket_entry}</p>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className={`text-xs font-bold ${isOverdue ? "text-red-400" : isUrgent ? "text-amber-300" : "text-slate-400"}`}>
                              {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                            </p>
                            <p className="text-[10px] text-slate-600">{fmtDate(entry.filed_date)}</p>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>

                      {expanded && (
                        <div className="px-5 pb-4 pt-0 border-t border-slate-800/60 space-y-3">
                          <p className="text-xs text-slate-300 leading-relaxed mt-3">{entry.docket_entry}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            <span>Filed by: <span className="text-slate-300">{entry.filed_by || "—"}</span></span>
                            <span>Deadline days: <span className="text-slate-300">{entry.deadline_days ?? 21}</span></span>
                          </div>
                          {/* Related tasks */}
                          {tasks.filter(t => t.ecf_inbox_id === entry.id).map(task => (
                            <div key={task.id} className="flex items-center gap-3 bg-slate-800/40 rounded-xl px-4 py-2.5">
                              <PriorityBadge priority={task.priority} />
                              <p className="text-xs text-white flex-1">{task.title}</p>
                              <StatusBadge status={task.status} />
                              {task.due_date && (
                                <span className="text-[10px] text-slate-500">{fmtDate(task.due_date)}</span>
                              )}
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <button onClick={() => setShowMotion(true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/25 text-amber-300 rounded-xl transition-colors">
                              <Gavel className="w-3 h-3" /> Draft Response
                            </button>
                            <button
                              onClick={async () => {
                                await sbFetch(`ecf_inbox?id=eq.${entry.id}`, { method: "PATCH", body: JSON.stringify({ status: "responded" }) });
                                load();
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/25 text-emerald-300 rounded-xl transition-colors">
                              <CheckCircle2 className="w-3 h-3" /> Mark Responded
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PRIORITY TASKS ── */}
        {tab === "tasks" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                className="bg-[#0b1220] border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none appearance-none">
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select value={attorneyFilter} onChange={e => setAttorneyFilter(e.target.value)}
                className="bg-[#0b1220] border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none appearance-none">
                {ATTORNEYS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-16 bg-[#0b1220] border border-slate-800 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No open tasks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Group by priority */}
                {["high", "medium", "low"].map(prio => {
                  const group = filteredTasks.filter(t => t.priority === prio && t.status !== "completed");
                  if (group.length === 0) return null;
                  const cfg = PRIORITY_CFG[prio];
                  return (
                    <div key={prio}>
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text}`}>
                          {cfg.label} Priority — {group.length}
                        </p>
                      </div>
                      <div className="space-y-1.5 mb-4">
                        {group.map(task => (
                          <div key={task.id} className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
                            <Circle className={`w-4 h-4 ${cfg.text} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white">{task.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {task.assigned_to && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <User className="w-3 h-3" />{task.assigned_to}
                                  </span>
                                )}
                                <StatusBadge status={task.status} />
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {task.due_date && (
                                <p className={`text-xs font-bold ${new Date(task.due_date) < new Date() ? "text-red-400" : "text-slate-400"}`}>
                                  {fmtDate(task.due_date)}
                                </p>
                              )}
                              <button
                                onClick={async () => {
                                  await sbFetch(`ecf_tasks?id=eq.${task.id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
                                  load();
                                }}
                                className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 mt-0.5 transition-colors">
                                Mark Done
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DRAFTS ── */}
        {tab === "drafts" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</p>
              <button onClick={() => setShowMotion(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors">
                <Plus className="w-3.5 h-3.5" /> New Draft
              </button>
            </div>
            {drafts.length === 0 ? (
              <div className="text-center py-16 bg-[#0b1220] border border-slate-800 rounded-2xl">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No drafts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {drafts.map(d => (
                  <div key={d.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl border bg-[#0b1220] border-slate-800 hover:border-slate-700 hover:bg-slate-800/20 transition-all cursor-pointer"
                    onClick={() => setEditDraft(d)}>
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{d.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">{d.case_number}</span>
                        <StatusBadge status={d.status} />
                        <span className="text-[10px] text-slate-600">by {d.created_by}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-600">{fmtDate(d.updated_at)}</p>
                      <button className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 ml-auto">
                        <Eye className="w-3 h-3" /> Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TEMPLATES ── */}
        {tab === "templates" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Motion shortcut cards */}
            <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Quick Draft Motions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: "Motion to Change Address", icon: <ArrowRight className="w-4 h-4 text-sky-400" />, desc: "Update debtor address on record" },
                  { title: "Motion to Value Collateral", icon: <Scale className="w-4 h-4 text-amber-400" />, desc: "§506(a) lien strip / value secured claim" },
                  { title: "Motion to Convert", icon: <RefreshCw className="w-4 h-4 text-teal-400" />, desc: "Convert Ch.13 to Ch.7 or vice versa" },
                  { title: "Motion to Avoid Judicial Lien", icon: <Gavel className="w-4 h-4 text-emerald-400" />, desc: "§522(f) lien avoidance on exempt property" },
                ].map(m => (
                  <button key={m.title} onClick={() => setShowMotion(true)}
                    className="flex items-start gap-3 p-4 rounded-2xl border border-slate-700/50 bg-[#0b1220] hover:border-amber-500/30 hover:bg-slate-800/30 transition-all text-left group">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">{m.icon}</div>
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">{m.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template library */}
            {templates.length === 0 ? (
              <div className="text-center py-12 bg-[#0b1220] border border-slate-800 rounded-2xl">
                <BookOpen className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No templates in library</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-start gap-4 px-5 py-4 rounded-2xl border bg-[#0b1220] border-slate-800">
                    <BookOpen className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">{t.category}</span>
                        {t.applicable_filing_type && (
                          <span className="text-[10px] text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-1.5 py-0.5">
                            {FILING_TYPE_LABELS[t.applicable_filing_type] ?? t.applicable_filing_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await sbFetch("pleading_drafts", {
                          method: "POST",
                          body: JSON.stringify({
                            template_id: t.id,
                            case_number: "PENDING",
                            title: t.name,
                            content: t.content_template,
                            status: "draft",
                            created_by: "Staff",
                          }),
                        });
                        load();
                        setTab("drafts");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex-shrink-0">
                      <Copy className="w-3 h-3" /> Use
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddEcf && <AddEcfModal onClose={() => setShowAddEcf(false)} onAdded={load} />}
      {showMotion && <QuickMotionModal onClose={() => setShowMotion(false)} onCreated={() => { load(); setTab("drafts"); }} />}
      {editDraft && <DraftEditor draft={editDraft} templates={templates} onClose={() => setEditDraft(null)} onSaved={() => { load(); setEditDraft(null); }} />}
    </div>
  );
}
