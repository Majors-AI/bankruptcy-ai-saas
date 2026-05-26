import { useState, useEffect, useCallback } from "react";
import { FileText, Inbox, Plus, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CreditCard as Edit3, Save, Send, Trash2, Calendar, Bell, RefreshCw, Search, Filter, Tag, Eye, X, Copy, Scale, Gavel, BookOpen, ClipboardList, Zap, CheckSquare, Circle, ArrowRight, Info, Download } from "lucide-react";

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

interface EcfRule {
  id: string;
  filing_type: string;
  rule_name: string;
  task_title: string;
  deadline_days: number;
  priority: string;
  auto_calendar_event: boolean;
  template_id: string | null;
  is_active: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const CATEGORY_LABELS: Record<string, string> = {
  change_of_address: "Change of Address",
  motion_response: "Motion Response",
  objection_response: "Objection Response",
  general: "General",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-400 bg-red-950/40 border-red-800/40",
  medium: "text-amber-400 bg-amber-950/40 border-amber-800/40",
  low: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 bg-amber-950/40 border-amber-800/40",
  task_created: "text-sky-400 bg-sky-950/40 border-sky-800/40",
  responded: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
  dismissed: "text-slate-400 bg-slate-800/40 border-slate-700/40",
  draft: "text-amber-400 bg-amber-950/40 border-amber-800/40",
  under_review: "text-sky-400 bg-sky-950/40 border-sky-800/40",
  filed: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
  archived: "text-slate-400 bg-slate-800/40 border-slate-700/40",
  open: "text-amber-400 bg-amber-950/40 border-amber-800/40",
  in_progress: "text-sky-400 bg-sky-950/40 border-sky-800/40",
  completed: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
};

function daysUntil(dateStr: string, deadlineDays: number) {
  const filed = new Date(dateStr);
  const due = new Date(filed);
  due.setDate(due.getDate() + deadlineDays);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Add ECF Modal ─────────────────────────────────────────────────────────────

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
    try {
      await sbFetch("ecf_inbox", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onAdded();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Inbox className="w-4 h-4 text-sky-400" /> Add ECF Entry
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Case Number</label>
              <input
                value={form.case_number}
                onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                placeholder="24-12345-BK"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Filed Date</label>
              <input
                type="date"
                value={form.filed_date}
                onChange={e => setForm(f => ({ ...f, filed_date: e.target.value }))}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Filing Type</label>
            <select
              value={form.filing_type}
              onChange={e => setForm(f => ({ ...f, filing_type: e.target.value }))}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {Object.entries(FILING_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Filed By</label>
            <input
              value={form.filed_by}
              onChange={e => setForm(f => ({ ...f, filed_by: e.target.value }))}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              placeholder="Creditor / Trustee / Court"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Docket Entry Description</label>
            <textarea
              rows={3}
              value={form.docket_entry}
              onChange={e => setForm(f => ({ ...f, docket_entry: e.target.value }))}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              placeholder="Paste the docket entry text..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || !form.case_number || !form.docket_entry}
            className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pleading Editor Modal ─────────────────────────────────────────────────────

function PleadingEditorModal({
  draft,
  onClose,
  onSaved,
}: {
  draft: PleadingDraft | null;
  template: PleadingTemplate | null;
  ecfEntry: EcfEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(draft?.content ?? "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [status, setStatus] = useState(draft?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save(newStatus?: string) {
    setSaving(true);
    try {
      const s = newStatus ?? status;
      if (draft?.id) {
        await sbFetch(`pleading_drafts?id=eq.${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, content, status: s, updated_at: new Date().toISOString() }),
        });
      }
      setStatus(s);
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0f1e] border border-slate-700/50 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-amber-400" />
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-slate-500 pb-0.5 min-w-[300px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${STATUS_COLORS[status] ?? ""}`}>
              {status}
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => save()}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => save("under_review")}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              Send for Review
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Editor */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <Info className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-500">Replace <span className="text-amber-400/80 font-mono">{`{{VARIABLE}}`}</span> placeholders with actual case information before filing.</span>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 w-full bg-slate-900/60 border border-slate-700/40 rounded-xl p-5 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-slate-500 resize-none"
            spellCheck={false}
          />
        </div>
        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => save("filed")}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              Mark as Filed
            </button>
            <button
              onClick={() => save("archived")}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Archive
            </button>
          </div>
          <span className="text-xs text-slate-600">{content.length} chars</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function LegalDocumentPortal() {
  const [activeTab, setActiveTab] = useState<"inbox" | "templates" | "drafts" | "tasks" | "rules">("inbox");
  const [ecfEntries, setEcfEntries] = useState<EcfEntry[]>([]);
  const [templates, setTemplates] = useState<PleadingTemplate[]>([]);
  const [drafts, setDrafts] = useState<PleadingDraft[]>([]);
  const [tasks, setTasks] = useState<EcfTask[]>([]);
  const [rules, setRules] = useState<EcfRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedEcf, setExpandedEcf] = useState<string | null>(null);
  const [showAddEcf, setShowAddEcf] = useState(false);
  const [editingDraft, setEditingDraft] = useState<{
    draft: PleadingDraft;
    template: PleadingTemplate | null;
    ecfEntry: EcfEntry | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ecf, tmpl, drft, tsk, rl] = await Promise.all([
        sbFetch("ecf_inbox?order=filed_date.desc"),
        sbFetch("pleading_templates?order=category.asc,name.asc"),
        sbFetch("pleading_drafts?order=created_at.desc"),
        sbFetch("ecf_tasks?order=due_date.asc"),
        sbFetch("ecf_rules?order=priority.asc,filing_type.asc"),
      ]);
      setEcfEntries(ecf ?? []);
      setTemplates(tmpl ?? []);
      setDrafts(drft ?? []);
      setTasks(tsk ?? []);
      setRules(rl ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Create draft from template
  async function createDraft(template: PleadingTemplate, ecfEntry?: EcfEntry) {
    try {
      const res = await sbFetch("pleading_drafts", {
        method: "POST",
        body: JSON.stringify({
          template_id: template.id,
          ecf_inbox_id: ecfEntry?.id ?? null,
          case_number: ecfEntry?.case_number ?? "",
          title: template.name,
          content: template.content_template,
          status: "draft",
          created_by: "Staff",
          client_id: ecfEntry?.client_id ?? null,
        }),
      });
      if (res && res[0]) {
        setEditingDraft({ draft: res[0], template, ecfEntry: ecfEntry ?? null });
        await load();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Apply rules and create tasks for an ECF entry
  async function applyRules(entry: EcfEntry) {
    const matchingRules = rules.filter(r => r.is_active && r.filing_type === entry.filing_type);
    if (matchingRules.length === 0) {
      const fallback = rules.find(r => r.is_active && r.filing_type === "general");
      if (fallback) matchingRules.push(fallback);
    }
    for (const rule of matchingRules) {
      const filedDate = new Date(entry.filed_date);
      const due = new Date(filedDate);
      due.setDate(due.getDate() + rule.deadline_days);
      try {
        await sbFetch("ecf_tasks", {
          method: "POST",
          body: JSON.stringify({
            ecf_inbox_id: entry.id,
            client_id: entry.client_id,
            rule_id: rule.id,
            title: rule.task_title,
            due_date: due.toISOString().split("T")[0],
            priority: rule.priority,
            assigned_to: "Attorney",
            status: "open",
            calendar_event_created: rule.auto_calendar_event,
          }),
        });
      } catch (e) {
        console.error(e);
      }
    }
    await sbFetch(`ecf_inbox?id=eq.${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "task_created" }),
    });
    await load();
  }

  // Suggest templates for a given filing type
  function suggestedTemplates(filingType: string) {
    return templates.filter(t => t.applicable_filing_type === filingType || t.applicable_filing_type === null);
  }

  const filteredEcf = ecfEntries.filter(e => {
    const matchSearch = !search || e.case_number.toLowerCase().includes(search.toLowerCase()) ||
      e.docket_entry.toLowerCase().includes(search.toLowerCase()) ||
      e.filed_by.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openTasks = tasks.filter(t => t.status === "open" || t.status === "in_progress");
  const pendingEcf = ecfEntries.filter(e => e.status === "pending").length;

  const TABS = [
    { id: "inbox" as const, label: "ECF Inbox", icon: <Inbox className="w-3.5 h-3.5" />, badge: pendingEcf > 0 ? pendingEcf : undefined },
    { id: "templates" as const, label: "Templates", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "drafts" as const, label: "Drafts", icon: <Edit3 className="w-3.5 h-3.5" />, badge: drafts.filter(d => d.status === "draft").length || undefined },
    { id: "tasks" as const, label: "Tasks", icon: <ClipboardList className="w-3.5 h-3.5" />, badge: openTasks.length || undefined },
    { id: "rules" as const, label: "Automation Rules", icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#090e1a] text-white">
      {/* Header */}
      <div className="border-b border-slate-800/60 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg shadow-amber-900/30">
              <Scale className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Legal Document Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Template pleadings, ECF inbox monitoring, and automated task/deadline generation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddEcf(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-3 h-3" />
              Add ECF Entry
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-slate-800/60 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          {[
            { label: "Pending ECF", value: pendingEcf, color: "text-amber-400" },
            { label: "Open Tasks", value: openTasks.length, color: "text-sky-400" },
            { label: "Drafts", value: drafts.filter(d => d.status === "draft").length, color: "text-slate-300" },
            { label: "Filed", value: drafts.filter(d => d.status === "filed").length, color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</span>
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800/60 px-6">
        <div className="max-w-7xl mx-auto flex gap-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* ECF INBOX */}
            {activeTab === "inbox" && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search case #, entry, filer..."
                      className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    {["all", "pending", "task_created", "responded"].map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                          filterStatus === s
                            ? "bg-amber-600/20 text-amber-400 border-amber-700/50"
                            : "text-slate-500 border-slate-700/40 hover:text-slate-300"
                        }`}
                      >
                        {s === "all" ? "All" : s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredEcf.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <Inbox className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">No ECF entries found</p>
                  </div>
                ) : (
                  filteredEcf.map(entry => {
                    const days = daysUntil(entry.filed_date, entry.deadline_days);
                    const isExpanded = expandedEcf === entry.id;
                    const entryTasks = tasks.filter(t => t.ecf_inbox_id === entry.id);
                    const suggested = suggestedTemplates(entry.filing_type);

                    return (
                      <div
                        key={entry.id}
                        className={`bg-slate-900/60 border rounded-xl transition-all ${
                          days <= 3 && entry.status === "pending"
                            ? "border-red-800/50 shadow-red-900/10 shadow-lg"
                            : "border-slate-700/40"
                        }`}
                      >
                        {/* Entry header */}
                        <div
                          className="flex items-start gap-4 p-4 cursor-pointer"
                          onClick={() => setExpandedEcf(isExpanded ? null : entry.id)}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {entry.status === "pending" && days <= 3
                              ? <AlertTriangle className="w-4 h-4 text-red-400" />
                              : entry.status === "responded" || entry.status === "task_created"
                              ? <CheckCircle2 className={`w-4 h-4 ${STATUS_COLORS[entry.status]?.split(" ")[0]}`} />
                              : <Inbox className="w-4 h-4 text-slate-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold text-white font-mono">{entry.case_number}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${STATUS_COLORS[entry.status] ?? ""}`}>
                                {entry.status.replace("_", " ")}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded border border-slate-700/40 text-slate-400 bg-slate-800/40">
                                {FILING_TYPE_LABELS[entry.filing_type] ?? entry.filing_type}
                              </span>
                              {entry.status === "pending" && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  days <= 0 ? "text-red-400 bg-red-950/60 border-red-800/50" :
                                  days <= 3 ? "text-red-400 bg-red-950/40 border-red-800/40" :
                                  days <= 7 ? "text-amber-400 bg-amber-950/40 border-amber-800/40" :
                                  "text-emerald-400 bg-emerald-950/40 border-emerald-800/40"
                                }`}>
                                  {days <= 0 ? "OVERDUE" : `${days}d left`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{entry.docket_entry}</p>
                            <div className="flex items-center gap-4 mt-1.5">
                              <span className="text-[10px] text-slate-500">Filed by: <span className="text-slate-400">{entry.filed_by}</span></span>
                              <span className="text-[10px] text-slate-500">{formatDate(entry.filed_date)}</span>
                              {entryTasks.length > 0 && (
                                <span className="text-[10px] text-sky-400">{entryTasks.length} task{entryTasks.length !== 1 ? "s" : ""} created</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-slate-500">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Expanded */}
                        {isExpanded && (
                          <div className="border-t border-slate-700/40 p-4 space-y-4">
                            {/* Actions */}
                            <div className="flex flex-wrap gap-2">
                              {entry.status === "pending" && (
                                <button
                                  onClick={() => applyRules(entry)}
                                  className="flex items-center gap-1.5 text-xs font-semibold bg-sky-700/30 hover:bg-sky-700/50 text-sky-300 border border-sky-700/40 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <Zap className="w-3 h-3" />
                                  Apply Rules &amp; Create Tasks
                                </button>
                              )}
                              <span className="text-xs text-slate-500 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Suggested templates:</span>
                              {suggested.slice(0, 3).map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => createDraft(t, entry)}
                                  className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/40 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  {t.name}
                                </button>
                              ))}
                            </div>

                            {/* Tasks for this entry */}
                            {entryTasks.length > 0 && (
                              <div>
                                <p className="text-xs text-slate-500 mb-2 font-semibold">Generated Tasks</p>
                                <div className="space-y-1.5">
                                  {entryTasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                                      {task.status === "completed"
                                        ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                        : <Circle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                      }
                                      <span className="text-xs text-slate-300 flex-1">{task.title}</span>
                                      {task.due_date && (
                                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                          <Calendar className="w-2.5 h-2.5" />
                                          Due {formatDate(task.due_date)}
                                        </span>
                                      )}
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${PRIORITY_COLORS[task.priority] ?? ""}`}>
                                        {task.priority}
                                      </span>
                                      {task.calendar_event_created && (
                                        <Bell className="w-3 h-3 text-sky-400" title="Calendar event created" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TEMPLATES */}
            {activeTab === "templates" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => {
                    const catTemplates = templates.filter(t => t.category === cat);
                    if (catTemplates.length === 0) return null;
                    return (
                      <div key={cat} className="bg-slate-900/60 border border-slate-700/40 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/40 bg-slate-800/30">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-bold text-white">{catLabel}</span>
                          <span className="ml-auto text-xs text-slate-500">{catTemplates.length} template{catTemplates.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="divide-y divide-slate-700/40">
                          {catTemplates.map(t => (
                            <div key={t.id} className="flex items-start gap-3 p-4 hover:bg-slate-800/30 transition-colors group">
                              <FileText className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0 group-hover:text-amber-400 transition-colors" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white">{t.name}</p>
                                {t.applicable_filing_type && (
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Triggered by: <span className="text-slate-400">{FILING_TYPE_LABELS[t.applicable_filing_type] ?? t.applicable_filing_type}</span>
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => createDraft(t)}
                                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/40 px-2.5 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Edit3 className="w-3 h-3" />
                                Use
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DRAFTS */}
            {activeTab === "drafts" && (
              <div className="space-y-3">
                {drafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <FileText className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">No drafts yet — use a template to get started</p>
                  </div>
                ) : (
                  drafts.map(d => {
                    const tmpl = templates.find(t => t.id === d.template_id);
                    const ecf = ecfEntries.find(e => e.id === d.ecf_inbox_id);
                    return (
                      <div key={d.id} className="flex items-center gap-4 bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600/60 transition-all group">
                        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-semibold text-white truncate max-w-sm">{d.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${STATUS_COLORS[d.status] ?? ""}`}>
                              {d.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            {d.case_number && <span className="text-[10px] text-slate-500 font-mono">{d.case_number}</span>}
                            {ecf && <span className="text-[10px] text-slate-500">From ECF: {FILING_TYPE_LABELS[ecf.filing_type] ?? ecf.filing_type}</span>}
                            {tmpl && <span className="text-[10px] text-slate-500">Template: {tmpl.name}</span>}
                            <span className="text-[10px] text-slate-600">Created {formatDate(d.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingDraft({ draft: d, template: tmpl ?? null, ecfEntry: ecf ?? null })}
                            className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Open
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TASKS */}
            {activeTab === "tasks" && (
              <div className="space-y-3">
                {/* Open tasks */}
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-bold text-white">All Generated Tasks</h2>
                  <span className="text-xs text-slate-500">{tasks.length} total</span>
                </div>
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <ClipboardList className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">No tasks yet — apply rules from an ECF entry</p>
                  </div>
                ) : (
                  tasks.map(task => {
                    const ecf = ecfEntries.find(e => e.id === task.ecf_inbox_id);
                    const days = task.due_date ? Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000) : null;
                    return (
                      <div key={task.id} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 flex items-start gap-3">
                        <button
                          onClick={async () => {
                            const newStatus = task.status === "completed" ? "open" : "completed";
                            await sbFetch(`ecf_tasks?id=eq.${task.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ status: newStatus }),
                            });
                            await load();
                          }}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {task.status === "completed"
                            ? <CheckSquare className="w-4 h-4 text-emerald-400" />
                            : <Circle className="w-4 h-4 text-slate-500 hover:text-slate-300 transition-colors" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-semibold ${task.status === "completed" ? "text-slate-500 line-through" : "text-white"}`}>
                              {task.title}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${PRIORITY_COLORS[task.priority] ?? ""}`}>
                              {task.priority}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${STATUS_COLORS[task.status] ?? ""}`}>
                              {task.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            {ecf && <span className="text-[10px] text-slate-500 font-mono">Case: {ecf.case_number}</span>}
                            {task.assigned_to && <span className="text-[10px] text-slate-500">Assigned: {task.assigned_to}</span>}
                            {task.due_date && (
                              <span className={`text-[10px] flex items-center gap-1 font-semibold ${
                                days !== null && days <= 0 ? "text-red-400" :
                                days !== null && days <= 3 ? "text-amber-400" : "text-slate-500"
                              }`}>
                                <Calendar className="w-2.5 h-2.5" />
                                Due {formatDate(task.due_date)}
                                {days !== null && days <= 7 && task.status !== "completed" && (
                                  <span>({days <= 0 ? "OVERDUE" : `${days}d`})</span>
                                )}
                              </span>
                            )}
                            {task.calendar_event_created && (
                              <span className="text-[10px] text-sky-400 flex items-center gap-1">
                                <Bell className="w-2.5 h-2.5" />Calendar
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* RULES */}
            {activeTab === "rules" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-sky-950/30 border border-sky-800/30 rounded-xl">
                  <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <p className="text-xs text-sky-300">
                    These rules automatically generate tasks and calendar deadlines when a matching ECF entry arrives.
                    Click "Apply Rules" on any ECF inbox entry to trigger them.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rules.map(rule => (
                    <div key={rule.id} className={`bg-slate-900/60 border rounded-xl p-4 ${rule.is_active ? "border-slate-700/40" : "border-slate-800/40 opacity-60"}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-xs font-bold text-white">{rule.rule_name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Trigger: <span className="text-slate-400">{FILING_TYPE_LABELS[rule.filing_type] ?? rule.filing_type}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${PRIORITY_COLORS[rule.priority] ?? ""}`}>
                            {rule.priority}
                          </span>
                          {rule.is_active
                            ? <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">active</span>
                            : <span className="text-[10px] text-slate-500 bg-slate-800/40 border border-slate-700/40 px-2 py-0.5 rounded">inactive</span>
                          }
                        </div>
                      </div>
                      <div className="bg-slate-800/40 rounded-lg p-2.5 space-y-1">
                        <div className="flex items-start gap-2">
                          <ClipboardList className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                          <span className="text-[10px] text-slate-300">{rule.task_title}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {rule.deadline_days}d deadline
                          </span>
                          {rule.auto_calendar_event && (
                            <span className="text-[10px] text-sky-400 flex items-center gap-1">
                              <Bell className="w-2.5 h-2.5" />
                              Auto calendar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddEcf && (
        <AddEcfModal onClose={() => setShowAddEcf(false)} onAdded={load} />
      )}
      {editingDraft && (
        <PleadingEditorModal
          draft={editingDraft.draft}
          template={editingDraft.template}
          ecfEntry={editingDraft.ecfEntry}
          onClose={() => setEditingDraft(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
