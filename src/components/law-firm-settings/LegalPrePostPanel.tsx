// Legal — pre/post petition task split + filing-entry + PACER review scaffold.
//
// Pre-petition tasks render always. Post-petition tasks are GREYED until the
// case is marked filed. Filing is marked from the e-filing portal — here we
// scaffold the same entry form (filing date + case number). PACER recon:
// if a PACER email indicates a case filed but the attorney hasn't marked it
// filed, the system creates a notification + review task for the attorney.

import { useState, createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { Gavel, Lock, FileCheck, Bell, Plus, X, Calendar, Hash } from "lucide-react";
import { useDepartmentStore } from "../department-management/store";
import { PRIORITY_TONE } from "../department-management/seedData";
import type { ViewerRole } from "../department-management/types";

// ─── Filings + PACER review store ──────────────────────────────────────────

export interface FilingRecord {
  caseId: string;
  clientName: string;
  filingDate: string;     // YYYY-MM-DD
  caseNumber: string;
  enteredBy: string;
  enteredAt: string;
}

export interface PacerReviewTask {
  id: string;
  caseId: string;
  clientName: string;
  pacerNotedDate: string; // YYYY-MM-DD per the PACER email
  reason: string;
  status: "pending" | "confirmed" | "dismissed";
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

interface FilingsApi {
  filings: FilingRecord[];
  pacerTasks: PacerReviewTask[];
  recordFiling(input: Omit<FilingRecord, "enteredAt">): void;
  isFiled(caseId: string): boolean;
  enqueuePacerReview(input: Omit<PacerReviewTask, "id" | "status" | "createdAt">): void;
  resolvePacer(id: string, action: "confirmed" | "dismissed", actor: string): void;
}

const Ctx = createContext<FilingsApi | null>(null);

function uid(p: string) { return `${p}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`; }

export function LegalFilingsProvider({ children }: { children: ReactNode }) {
  const [filings, setFilings] = useState<FilingRecord[]>([]);
  const [pacerTasks, setPacerTasks] = useState<PacerReviewTask[]>([]);

  const recordFiling = useCallback<FilingsApi["recordFiling"]>((input) => {
    setFilings(prev => {
      const others = prev.filter(f => f.caseId !== input.caseId);
      return [{ ...input, enteredAt: new Date().toISOString() }, ...others];
    });
  }, []);

  const isFiled = useCallback((caseId: string) => filings.some(f => f.caseId === caseId), [filings]);

  const enqueuePacerReview = useCallback<FilingsApi["enqueuePacerReview"]>((input) => {
    setPacerTasks(prev => [{ id: uid("pacer"), status: "pending", createdAt: new Date().toISOString(), ...input }, ...prev]);
  }, []);

  const resolvePacer = useCallback<FilingsApi["resolvePacer"]>((id, action, actor) => {
    setPacerTasks(prev => prev.map(p => p.id === id ? { ...p, status: action, resolvedBy: actor, resolvedAt: new Date().toISOString() } : p));
  }, []);

  const api: FilingsApi = useMemo(() => ({ filings, pacerTasks, recordFiling, isFiled, enqueuePacerReview, resolvePacer }),
    [filings, pacerTasks, recordFiling, isFiled, enqueuePacerReview, resolvePacer]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useLegalFilings(): FilingsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLegalFilings must be used inside LegalFilingsProvider");
  return v;
}

// ─── UI ────────────────────────────────────────────────────────────────────

interface Props { viewerRole: ViewerRole; }

// We split tasks into PRE / POST by a `note` convention or by an explicit
// task ID prefix. To stay non-invasive we annotate the seed labels here.
const PRE_PETITION_LABELS = new Set([
  "Case review",
  "Welcome calls (post-retainer)",
]);
const POST_PETITION_LABELS = new Set([
  "Schedules & SOFA filing",
  "341 meeting prep",
  "Trustee questionnaire response",
]);

export default function LegalPrePostPanel({ viewerRole }: Props) {
  const store = useDepartmentStore();
  const filings = useLegalFilings();
  const isAttorney =
    viewerRole === "attorney"
    || viewerRole === "law_firm_owner"
    || viewerRole === "super_admin";

  const legalTasks = store.tasks.filter(t => t.departmentId === "legal");
  // Auto-tag tasks not in either set as "pre" by default — case review etc.
  // The Tasks section in Department Management already lets the supervisor
  // add post-petition tasks; we surface here both lists.
  const preTasks = legalTasks.filter(t => !POST_PETITION_LABELS.has(t.label));
  const postTasks = legalTasks.filter(t => POST_PETITION_LABELS.has(t.label));

  // Demo: a single representative case in the panel. Real wiring binds a case
  // record selector to the File Cabinet.
  const [caseId, setCaseId] = useState<string>("case-demo-001");
  const [clientName, setClientName] = useState<string>("[Demo] Pending signing — AZ");
  const filed = filings.isFiled(caseId);
  const filing = filings.filings.find(f => f.caseId === caseId);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Gavel className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">Legal · pre / post-petition tasks</p>
        </div>
        <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
          Pre-petition tasks run from intake handoff to filing. Post-petition tasks UNLOCK
          when the case is marked filed (filing date + case number). Filing is recorded in
          the e-filing portal; the same entry form is mirrored below for the scaffold.
        </p>

        {/* Demo case selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <Field label="Case ID (demo)">
            <input value={caseId} onChange={e => setCaseId(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Client (demo)">
            <input value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Filing entry */}
        <FilingEntry
          caseId={caseId}
          clientName={clientName}
          filed={filed}
          filing={filing}
          canEnter={isAttorney}
        />

        {/* Task lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
          <TaskColumn title="Pre-petition" tasks={preTasks} disabled={false} />
          <TaskColumn title="Post-petition" tasks={postTasks} disabled={!filed} />
        </div>
      </div>

      <PacerReviewPanel viewerRole={viewerRole} />
    </div>
  );
}

function FilingEntry({
  caseId, clientName, filed, filing, canEnter,
}: { caseId: string; clientName: string; filed: boolean; filing?: FilingRecord; canEnter: boolean }) {
  const filings = useLegalFilings();
  const [filingDate, setFilingDate] = useState<string>(filing?.filingDate ?? "");
  const [caseNumber, setCaseNumber] = useState<string>(filing?.caseNumber ?? "");

  function save() {
    if (!filingDate || !caseNumber.trim()) return;
    filings.recordFiling({ caseId, clientName, filingDate, caseNumber: caseNumber.trim(), enteredBy: "current_user" });
    alert("Filing recorded — post-petition tasks unlocked.");
  }

  return (
    <div className={`rounded border p-3 ${filed ? "border-emerald-700/40 bg-emerald-900/10" : "border-[#2A2A28] bg-[#1A1A18]"}`}>
      <div className="flex items-center gap-2 mb-2">
        {filed ? <FileCheck className="w-4 h-4 text-emerald-300" /> : <Calendar className="w-4 h-4 text-[#6B6B66]" />}
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">
          {filed ? "Filed" : "Filing entry"}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field label="Filing date">
          <input
            type="date"
            disabled={!canEnter || filed}
            value={filingDate}
            onChange={e => setFilingDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Case number">
          <input
            type="text"
            disabled={!canEnter || filed}
            value={caseNumber}
            onChange={e => setCaseNumber(e.target.value)}
            placeholder="e.g. 26-12345"
            className={inputCls}
          />
        </Field>
        {!filed && canEnter && (
          <div className="flex items-end">
            <button onClick={save} className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border" style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}>
              <Hash className="w-3 h-3" /> Mark filed
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        {/* TODO Phase B — synchronize with the e-filing portal: the same entry
            here updates case_records.filed_at + case_number; assignments for
            post-petition tasks fire from a database trigger. */}
        Mirrored from the e-filing portal. Database write + post-petition task assignment
        wire in the follow-up build.
      </p>
    </div>
  );
}

function TaskColumn({ title, tasks, disabled }: { title: string; tasks: Array<{ id: string; label: string; priority: "high" | "medium" | "low" }>; disabled: boolean }) {
  return (
    <div className={`rounded border p-3 ${disabled ? "border-[#2A2A28] bg-[#0F0F0E] opacity-60" : "border-[#2A2A28] bg-[#1A1A18]"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">{title}</p>
        {disabled && <span className="inline-flex items-center gap-1 text-[10px] text-[#6B6B66]"><Lock className="w-3 h-3" /> unlocks at filing</span>}
      </div>
      {tasks.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No tasks defined.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#0F0F0E] border border-[#2A2A28]">
              <span className="text-[11px] font-semibold text-[#FAFAF7]">{t.label}</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${PRIORITY_TONE[t.priority]}`}>
                {t.priority}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── PACER reconciliation ──────────────────────────────────────────────────

function PacerReviewPanel({ viewerRole }: { viewerRole: ViewerRole }) {
  const filings = useLegalFilings();
  const isAttorney = viewerRole === "attorney" || viewerRole === "law_firm_owner" || viewerRole === "super_admin";

  const [pCaseId, setPCaseId] = useState<string>("case-demo-001");
  const [pName, setPName] = useState<string>("[Demo] Pending signing — AZ");
  const [pDate, setPDate] = useState<string>("");

  function simulatePacer() {
    if (!pDate) return;
    filings.enqueuePacerReview({
      caseId: pCaseId,
      clientName: pName,
      pacerNotedDate: pDate,
      reason: "PACER email indicates filing; attorney has not marked filed in the e-filing portal.",
    });
    setPDate("");
    alert("PACER review task created (scaffold).");
  }

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />
          <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">PACER reconciliation</p>
        </div>
      </div>
      <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
        If a PACER email indicates a case filed but the attorney hasn't marked it filed in
        the e-filing portal, the system creates a notification + a review task here. The
        attorney confirms or dismisses. PACER ingestion = backend TODO; the form below
        simulates an inbound event.
      </p>

      {/* PACER simulator (attorney only — the real version listens to inbound
          PACER emails). */}
      {isAttorney && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 rounded border border-dashed border-[#2A2A28] p-3">
          <Field label="Case ID"><input value={pCaseId} onChange={e => setPCaseId(e.target.value)} className={inputCls} /></Field>
          <Field label="Client"><input value={pName} onChange={e => setPName(e.target.value)} className={inputCls} /></Field>
          <Field label="PACER date"><input type="date" value={pDate} onChange={e => setPDate(e.target.value)} className={inputCls} /></Field>
          <div className="flex items-end">
            <button onClick={simulatePacer} className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border" style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}>
              <Plus className="w-3 h-3" /> Simulate PACER hit
            </button>
          </div>
        </div>
      )}

      {/* Queue */}
      {filings.pacerTasks.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No PACER reconciliation tasks.</p>
      ) : (
        <ul className="space-y-1.5">
          {filings.pacerTasks.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#1A1A18] border border-[#2A2A28]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#FAFAF7]">{p.clientName} <span className="text-[#6B6B66]">(PACER noted {p.pacerNotedDate})</span></p>
                <p className="text-[10px] text-[#6B6B66]">{p.reason}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                  p.status === "confirmed" ? "border-emerald-700/60 bg-emerald-900/30 text-emerald-200"
                  : p.status === "dismissed" ? "border-rose-700/60 bg-rose-900/30 text-rose-200"
                  : "border-[#2A2A28] text-[#6B6B66]"
                }`}>{p.status}</span>
                {isAttorney && p.status === "pending" && (
                  <>
                    <button onClick={() => filings.resolvePacer(p.id, "confirmed", "current_user")} className="text-[10px] font-semibold text-emerald-100 border border-emerald-700/60 bg-emerald-900/30 px-2 py-0.5 rounded">
                      Confirm filed
                    </button>
                    <button onClick={() => filings.resolvePacer(p.id, "dismissed", "current_user")} className="text-[10px] font-semibold text-[#6B6B66] border border-[#2A2A28] px-2 py-0.5 rounded hover:text-white">
                      Not us
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        {/* TODO Phase B — PACER ingestion:
              - inbound email parser (subject "PACER NEF: ...") writes into
                pacer_filing_notices(case_id, filed_at, doc_url)
              - cron job compares pacer_filing_notices against case_records.filed_at
                and enqueues a pacer_review_task when divergent */}
        PACER ingestion + cron diff land with the backend wiring.
      </p>
    </div>
  );
}

const inputCls = "w-full bg-[#0F0F0E] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{label}</span>
      {children}
    </label>
  );
}
