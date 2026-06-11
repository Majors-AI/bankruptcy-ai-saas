// Collections workspace — Accounting-only. Scaffold shell with queue,
// dialer button, message buttons, and pump-through disposition workflow.
//
// Telephony (click-to-call) = Twilio Voice TODO.
// Messaging (SMS/email)     = Twilio (SMS) + SendGrid (email) TODO.
// System auto-handling of routine collections = TODO (rules + cron).

import { useState } from "react";
import {
  PhoneCall, MessageSquare, Mail, ArrowRight, CheckCircle2,
  AlertTriangle, RefreshCw, Smile,
} from "lucide-react";
import { useDepartmentStore } from "./store";
import { PRIORITY_TONE } from "./seedData";
import type { CollectionsDisposition } from "./types";

const DISPOSITIONS: Array<{ key: CollectionsDisposition; label: string; tone: string; icon: typeof PhoneCall }> = [
  { key: "paid",              label: "Paid",                    tone: "border-emerald-700/60 bg-emerald-900/30 text-emerald-100", icon: CheckCircle2 },
  { key: "promise_to_pay",    label: "Promise-to-pay",          tone: "border-amber-700/60 bg-amber-900/30 text-amber-100",       icon: AlertTriangle },
  { key: "no_answer",         label: "No answer",               tone: "border-slate-700 bg-slate-800 text-slate-200",             icon: RefreshCw },
  { key: "adjust_payment",    label: "Adjust payment",          tone: "border-sky-700/60 bg-sky-900/30 text-sky-100",             icon: RefreshCw },
  { key: "saved_from_cancel", label: "Saved from cancel",       tone: "border-emerald-700/60 bg-emerald-900/30 text-emerald-100", icon: Smile },
];

export default function CollectionsWorkspace() {
  const store = useDepartmentStore();
  const next = store.pickNextCollectionsAccount();
  const remaining = store.collectionsQueue.filter(a => a.status === "queued").length;
  const resolved = store.collectionsQueue.filter(a => a.status === "resolved").length;
  const [note, setNote] = useState("");

  function handle(disposition: CollectionsDisposition) {
    if (!next) return;
    store.disposeCollections(next.id, disposition, note.trim() || undefined);
    setNote("");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-[#FAFAF7]">Collections workspace</p>
          <p className="text-[11px] text-[#6B6B66]">
            Accounting · pump-through queue · {remaining} queued · {resolved} resolved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] px-2 py-0.5 rounded">Scaffold</span>
        </div>
      </div>

      {/* Active account — the next-up pump-through card. */}
      {!next ? (
        <div className="rounded-lg border border-[#2A2A28] bg-[#1A1A18] p-6 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#FAFAF7]">Queue clear</p>
          <p className="text-[11px] text-[#6B6B66] mt-1">No accounts in the queue.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-base font-semibold text-[#FAFAF7]">{next.clientName}</p>
              <p className="text-[11px] text-[#6B6B66]">
                {next.ageDays} days past due · ${next.amountOwed.toFixed(2)}
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${PRIORITY_TONE[next.priority]}`}>
              {next.priority}
            </span>
          </div>

          {/* Dialer + Message buttons — scaffolds. */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              onClick={() => alert("TODO — Twilio Voice click-to-call wiring")}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-100 border border-amber-700 bg-amber-700/40 px-3 py-1.5 rounded hover:bg-amber-700/60"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Call (click-to-call)
            </button>
            <button
              onClick={() => alert("TODO — Twilio SMS dispatch")}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FAFAF7] border border-[#2A2A28] bg-[#1A1A18] px-3 py-1.5 rounded hover:bg-[#2A2A28]"
            >
              <MessageSquare className="w-3.5 h-3.5" /> SMS
            </button>
            <button
              onClick={() => alert("TODO — SendGrid email dispatch")}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FAFAF7] border border-[#2A2A28] bg-[#1A1A18] px-3 py-1.5 rounded hover:bg-[#2A2A28]"
            >
              <Mail className="w-3.5 h-3.5" /> Email
            </button>
          </div>

          {/* Disposition buttons — pump-through workflow. */}
          <div className="space-y-2">
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note (optional) — e.g. 'PTP next Friday'"
              className="w-full bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {DISPOSITIONS.map(d => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.key}
                    onClick={() => handle(d.key)}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded border ${d.tone}`}
                  >
                    <Icon className="w-3 h-3" /> {d.label}
                  </button>
                );
              })}
              <span className="text-[10px] text-[#6B6B66] inline-flex items-center gap-1 ml-2">
                <ArrowRight className="w-3 h-3" /> auto-advances to next account
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Queue list. */}
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <p className="text-xs font-semibold text-[#FAFAF7] mb-2">Queue (oldest + highest priority first)</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="text-[#6B6B66]">
                <th className="text-left px-2 py-1">Client</th>
                <th className="text-right px-2 py-1">Age</th>
                <th className="text-right px-2 py-1">Amount</th>
                <th className="text-center px-2 py-1">Priority</th>
                <th className="text-center px-2 py-1">Status</th>
                <th className="text-left px-2 py-1">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {store.collectionsQueue.map(a => (
                <tr key={a.id} className="border-t border-[#2A2A28]">
                  <td className="px-2 py-1 text-[#FAFAF7]">{a.clientName}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{a.ageDays}d</td>
                  <td className="px-2 py-1 text-right tabular-nums">${a.amountOwed.toFixed(2)}</td>
                  <td className="px-2 py-1 text-center">
                    <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${PRIORITY_TONE[a.priority]}`}>
                      {a.priority}
                    </span>
                  </td>
                  <td className={`px-2 py-1 text-center font-semibold ${
                    a.status === "resolved" ? "text-emerald-300" : a.status === "in_progress" ? "text-amber-300" : "text-[#6B6B66]"
                  }`}>
                    {a.status === "resolved"
                      ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> resolved</span>
                      : a.status === "in_progress" ? "in progress" : "queued"}
                  </td>
                  <td className="px-2 py-1 text-[#6B6B66]">
                    {a.lastContact ? new Date(a.lastContact).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-[#6B6B66] italic leading-snug">
        {/* TODO Phase B — collections wiring:
            - Twilio Voice (click-to-call) + recording / consent capture
            - Twilio SMS + SendGrid email — opt-out check + template fetch
            - System auto-handling: rules engine for routine touches (e.g.
              auto-SMS at day 3 / 7 / 14 if no contact), human-handoff on
              promise-to-pay
            - Persistence on collections_accounts + collections_dispositions tables
            - RLS scopes the queue per firm + per accounting role */}
        Telephony, messaging, and system auto-handling of routine collections are wired to
        TODO scaffolds. The pump-through dispositions write to the in-memory queue and the
        audit log so the workflow is testable today.
      </p>
    </div>
  );
}
