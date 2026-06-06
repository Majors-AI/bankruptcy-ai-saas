import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ClipboardList, Phone, Mail, MessageSquare, CreditCard as Edit3, FileText, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

interface ActivityLog {
  id: string;
  submission_id: string | null;
  draft_id: string | null;
  activity_type: string;
  actor: string;
  summary: string;
  detail: Record<string, unknown>;
  change_reason: string;
  change_reason_note: string;
  client_notified: boolean;
  created_at: string;
}

interface Props {
  submissionId?: string;
  draftId?: string;
  clientName?: string;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  income_edit: <Edit3 size={13} className="text-green-400" />,
  expense_edit: <Edit3 size={13} className="text-amber-400" />,
  income_expense_edit: <Edit3 size={13} className="text-blue-400" />,
  phone_call: <Phone size={13} className="text-sky-400" />,
  email: <Mail size={13} className="text-violet-400" />,
  sms: <MessageSquare size={13} className="text-teal-400" />,
  platform_message: <MessageSquare size={13} className="text-blue-400" />,
  note: <FileText size={13} className="text-slate-400" />,
  system_event: <ClipboardList size={13} className="text-slate-500" />,
};

const ACTIVITY_LABELS: Record<string, string> = {
  income_edit: "Income Adjusted",
  expense_edit: "Expenses Adjusted",
  income_expense_edit: "Income & Expenses Adjusted",
  phone_call: "Phone Call",
  email: "Email",
  sms: "SMS",
  platform_message: "Platform Message",
  note: "Note",
  system_event: "System Event",
};

const ACTIVITY_BADGE: Record<string, string> = {
  income_edit: "bg-green-500/15 text-green-300 border-green-500/30",
  expense_edit: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  income_expense_edit: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  phone_call: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  email: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  sms: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  platform_message: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  note: "bg-slate-700/50 text-slate-400 border-slate-600/40",
  system_event: "bg-slate-800/50 text-slate-500 border-slate-700/40",
};

const CHANGE_REASON_LABELS: Record<string, string> = {
  correction_by_debtor: "Correction by Debtor",
  over_irs_standard: "Over IRS Living Standard",
  other: "Other",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export default function CaseActivityLog({ submissionId, draftId, clientName }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadLogs();
  }, [submissionId, draftId]);

  async function loadLogs() {
    setLoading(true);
    let query = supabase
      .from("case_activity_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (submissionId) {
      query = query.eq("submission_id", submissionId);
    } else if (draftId) {
      query = query.eq("draft_id", draftId);
    }

    const { data } = await query;
    setLogs((data as ActivityLog[]) ?? []);
    setLoading(false);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filterTypes = [
    { value: "all", label: "All" },
    { value: "income_edit,expense_edit,income_expense_edit", label: "File Edits" },
    { value: "phone_call", label: "Calls" },
    { value: "email", label: "Emails" },
    { value: "sms", label: "SMS" },
    { value: "platform_message", label: "Messages" },
    { value: "note", label: "Notes" },
  ];

  const filteredLogs = filter === "all"
    ? logs
    : logs.filter(l => filter.split(",").includes(l.activity_type));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-slate-400" />
          <span className="text-[12px] font-bold text-slate-300 uppercase tracking-wider">Case Activity Log</span>
          {clientName && <span className="text-[11px] text-slate-600">— {clientName}</span>}
        </div>
        <button
          onClick={loadLogs}
          className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          <RefreshCw size={11} className="text-slate-400" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-slate-700/40 overflow-x-auto flex-shrink-0">
        {filterTypes.map(ft => (
          <button
            key={ft.value}
            onClick={() => setFilter(ft.value)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors ${
              filter === ft.value
                ? "bg-slate-700 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {ft.label}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-600 text-[12px]">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <AlertCircle size={20} className="text-slate-700" />
            <p className="text-[12px] text-slate-600">No activity recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredLogs.map(log => {
              const isOpen = expanded.has(log.id);
              const badge = ACTIVITY_BADGE[log.activity_type] ?? ACTIVITY_BADGE.note;
              const icon = ACTIVITY_ICONS[log.activity_type] ?? ACTIVITY_ICONS.note;
              const hasDetail = Object.keys(log.detail ?? {}).length > 0 || log.change_reason || log.change_reason_note;
              const changedFields = (log.detail?.changed_fields ?? {}) as Record<string, { from: string | null; to: string }>;
              const fieldCount = Object.keys(changedFields).length;

              return (
                <div key={log.id} className="px-4 py-3 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge}`}>
                          {ACTIVITY_LABELS[log.activity_type] ?? log.activity_type}
                        </span>
                        {log.client_notified && (
                          <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded">
                            Client Notified
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-200 leading-snug">{log.summary}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-600">{log.actor}</span>
                        <span className="text-[10px] text-slate-700">·</span>
                        <span className="text-[10px] text-slate-600" title={fullDate(log.created_at)}>
                          {timeAgo(log.created_at)}
                        </span>
                      </div>

                      {hasDetail && (
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="flex items-center gap-1 mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          {isOpen ? "Hide details" : `Show details${fieldCount > 0 ? ` (${fieldCount} field${fieldCount !== 1 ? "s" : ""} changed)` : ""}`}
                        </button>
                      )}

                      {isOpen && (
                        <div className="mt-2 space-y-2">
                          {log.change_reason && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                              <p className="text-[10px] font-bold text-amber-400 mb-0.5">Reason for Change</p>
                              <p className="text-[11px] text-slate-300">{CHANGE_REASON_LABELS[log.change_reason] ?? log.change_reason}</p>
                              {log.change_reason_note && (
                                <p className="text-[11px] text-slate-500 mt-0.5">{log.change_reason_note}</p>
                              )}
                            </div>
                          )}
                          {fieldCount > 0 && (
                            <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Field Changes</p>
                              <div className="space-y-1">
                                {Object.entries(changedFields).map(([key, change]) => (
                                  <div key={key} className="flex items-center gap-2 text-[11px]">
                                    <span className="text-slate-500 font-mono truncate max-w-[120px]">{key}</span>
                                    <span className="text-red-400/70 line-through">${change.from ?? "0"}</span>
                                    <span className="text-slate-600">→</span>
                                    <span className="text-green-400">${change.to || "0"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {log.detail?.body && (
                            <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Message</p>
                              <p className="text-[11px] text-slate-400 whitespace-pre-wrap">{log.detail.body as string}</p>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-700">{fullDate(log.created_at)}</p>
                        </div>
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
