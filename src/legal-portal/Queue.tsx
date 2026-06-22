// Queue — R3 from docs/design/legal-portal-reference.jsx (lines 1023–1071).
//
// Three filter chips (Needs you · Waiting on client · All cases), case
// rows with stage badge + next-step + assignee, Active Caseload bubble
// above the chips (per §8 A3 of the function-mapping doc), Today's
// hearings/filings strip below the rows (per §8 A4).
//
// Wires to data already loaded by LegalDepartmentPortal's mount-level
// Promise.all — Queue does not fetch on its own.

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, AlertCircle, Bot } from "lucide-react";
import { c, STAGE_BY_KEY, NEXT_STEP, type LegalRole, type StageKey } from "./legalPortalTokens";
import { Eyebrow, Pill, StageBadge, InitialsAvatar } from "./primitives";
import { buildQueueRows, computeCaseloadCounts, filterEventsToday, type QueueRow } from "./buildQueueRows";
import type {
  AttorneyIntakeReviewRow,
  SigningReviewRow,
  ParalegalReviewRow,
  IntakeLeadRow,
  AcceptanceRow,
  FiledCaseRegistryRow,
  CalendarEventRow,
} from "../components/legal/legalTasks";

export interface QueueProps {
  role: LegalRole;
  intakeLeads: ReadonlyArray<IntakeLeadRow>;
  attorneyIntakeReviews: ReadonlyArray<AttorneyIntakeReviewRow>;
  signingReviews: ReadonlyArray<SigningReviewRow>;
  paralegalReviews: ReadonlyArray<ParalegalReviewRow>;
  acceptances: ReadonlyArray<AcceptanceRow>;
  filedRegistry: ReadonlyArray<FiledCaseRegistryRow>;
  calendarEvents: ReadonlyArray<CalendarEventRow>;
  /** Click-handler for a case row. Receives the leadId so the parent
   *  can update selectedLeadId state + URL. */
  onOpenCase: (leadId: string) => void;
}

type FilterKey = "needs" | "client" | "all";

// Stages that the "Waiting on client" filter chip surfaces (per the
// reference's matching logic).
const WAITING_ON_CLIENT: ReadonlySet<StageKey> = new Set<StageKey>([
  "fixes", "approved", "schedule",
]);

export default function Queue({
  role,
  intakeLeads,
  attorneyIntakeReviews,
  signingReviews,
  paralegalReviews,
  acceptances,
  filedRegistry,
  calendarEvents,
  onOpenCase,
}: QueueProps) {
  const [filter, setFilter] = useState<FilterKey>("needs");

  const rows = useMemo<QueueRow[]>(
    () => buildQueueRows({
      role,
      intakeLeads,
      attorneyIntakeReviews,
      signingReviews,
      paralegalReviews,
      acceptances,
      filedRegistry,
    }),
    [role, intakeLeads, attorneyIntakeReviews, signingReviews, paralegalReviews, acceptances, filedRegistry],
  );

  const caseload = useMemo(
    () => computeCaseloadCounts(acceptances, filedRegistry),
    [acceptances, filedRegistry],
  );

  const todayEvents = useMemo(
    () => filterEventsToday(calendarEvents),
    [calendarEvents],
  );

  const needsCount = rows.filter(r => r.needsAction).length;

  const filtered = rows.filter(r =>
    filter === "needs"  ? r.needsAction :
    filter === "client" ? WAITING_ON_CLIENT.has(r.stage) :
                          true,
  );

  const chips: ReadonlyArray<{ k: FilterKey; label: string }> = [
    { k: "needs",  label: `Needs you · ${needsCount}` },
    { k: "client", label: "Waiting on client" },
    { k: "all",    label: `All cases · ${rows.length}` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Eyebrow>{role === "attorney" ? "Attorney queue" : "Paralegal queue"}</Eyebrow>
      <h1
        className="text-3xl font-bold mt-1"
        style={{ color: c.ink, letterSpacing: "-0.02em" }}
      >
        Your case queue
      </h1>
      <p className="mt-1 text-sm" style={{ color: c.slate }}>
        {needsCount} case{needsCount === 1 ? "" : "s"} waiting on you · {rows.length} active in the firm
      </p>

      {/* Active Caseload bubble — Ch.7 / Ch.13 / filed counts */}
      <CaseloadBubble counts={caseload} />

      {/* Filter chips */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        {chips.map(ch => {
          const active = filter === ch.k;
          return (
            <button
              key={ch.k}
              type="button"
              onClick={() => setFilter(ch.k)}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
              style={{
                background: active ? c.ink : c.paper,
                color: active ? "#fff" : c.slate,
                border: `1px solid ${active ? c.ink : c.line}`,
              }}
            >
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        filtered.map(r => <Row key={r.leadId} row={r} onOpenCase={onOpenCase} />)
      )}

      {/* Today footer — calendar events for today, scoped to legal */}
      <TodayFooter events={todayEvents} />
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────

function Row({ row, onOpenCase }: { row: QueueRow; onOpenCase: (leadId: string) => void }) {
  const meta = STAGE_BY_KEY[row.stage];
  const Icon = meta?.icon;
  return (
    <button
      type="button"
      onClick={() => onOpenCase(row.leadId)}
      className="w-full flex items-center gap-4 rounded-xl px-4 py-3.5 mb-2 text-left"
      style={{
        background: c.paper,
        border: `1px solid ${row.needsAction ? c.amberLine : c.line}`,
      }}
    >
      <div
        className="shrink-0 rounded-xl flex items-center justify-center"
        style={{ width: 42, height: 42, background: c.bgWarm }}
      >
        {Icon && <Icon size={19} style={{ color: row.needsAction ? c.amber : c.slate }} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold" style={{ color: c.ink }}>
            {row.clientName}
          </span>
          {row.chapter && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: c.bg, color: c.slate }}
            >
              Chapter {row.chapter}
            </span>
          )}
          {row.needsAction && <Pill tone="flag">Needs you</Pill>}
          {row.postPetition && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: c.redSoft, color: c.red, border: `1px solid ${c.red}` }}
            >
              <AlertCircle size={12} /> Post-petition issue
            </span>
          )}
        </div>
        <div className="text-sm mt-0.5" style={{ color: c.slate }}>
          {NEXT_STEP[row.stage]}
        </div>
        {/* Bot signal placeholder — wired from real intake-bot activity in a later slice. */}
        {row.stage === "fixes" && (
          <span className="inline-flex items-center gap-1 mt-1 text-xs" style={{ color: c.slateLight }}>
            <Bot size={12} /> Reminder bot pinged client
          </span>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <StageBadge stage={row.stage} />
        <div className="flex items-center gap-2">
          <InitialsAvatar name={row.assignee} />
          <span className="text-xs" style={{ color: c.slateLight }}>
            {row.updatedAt ? formatUpdated(row.updatedAt) : "—"}
          </span>
          <ChevronRight size={16} style={{ color: c.slateLight }} />
        </div>
      </div>
    </button>
  );
}

function formatUpdated(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Empty state ───────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterKey }) {
  const hint =
    filter === "needs"  ? `Switch to "All cases" to see the full firm pipeline.` :
    filter === "client" ? `No cases waiting on the client right now.` :
                          "No active cases in the firm.";
  return (
    <div
      className="rounded-xl py-16 text-center"
      style={{ background: c.paper, border: `1px dashed ${c.line}` }}
    >
      <CheckCircle2 size={28} style={{ color: c.teal }} className="mx-auto" />
      <p className="mt-2 text-sm font-semibold" style={{ color: c.ink }}>
        Nothing waiting on you right now.
      </p>
      <p className="text-xs mt-0.5" style={{ color: c.slate }}>
        {hint}
      </p>
    </div>
  );
}

// ── Active Caseload bubble (KPI row above the filter chips) ────────────

function CaseloadBubble({ counts }: { counts: ReturnType<typeof computeCaseloadCounts> }) {
  const totalRetained = counts.retainedCh7 + counts.retainedCh13;
  const totalFiled    = counts.filedCh7    + counts.filedCh13;
  const cells: ReadonlyArray<{ label: string; value: string; tone: "ok" | "ink" }> = [
    { label: "Retained · Ch.7",  value: String(counts.retainedCh7),  tone: "ink" },
    { label: "Retained · Ch.13", value: String(counts.retainedCh13), tone: "ink" },
    { label: "Filed · Ch.7",     value: String(counts.filedCh7),     tone: "ok" },
    { label: "Filed · Ch.13",    value: String(counts.filedCh13),    tone: "ok" },
    { label: "Pending discharge", value: "—",                        tone: "ink" }, // §12-deferred
  ];
  return (
    <div
      className="flex flex-wrap items-center gap-3 mt-4 rounded-xl px-4 py-3"
      style={{ background: c.paper, border: `1px solid ${c.line}` }}
    >
      <Eyebrow>Active caseload</Eyebrow>
      <div className="flex flex-wrap items-center gap-2">
        {cells.map(cell => (
          <span
            key={cell.label}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
            style={{
              background: cell.tone === "ok" ? c.tealSoft : c.bg,
              color:      cell.tone === "ok" ? c.teal     : c.ink,
              border:    `1px solid ${cell.tone === "ok" ? c.tealLine : c.line}`,
            }}
          >
            <span style={{ color: c.slate }}>{cell.label}</span>
            <span>{cell.value}</span>
          </span>
        ))}
      </div>
      <div className="ml-auto text-xs" style={{ color: c.slateLight }}>
        {totalRetained} retained · {totalFiled} filed
      </div>
    </div>
  );
}

// ── Today's hearings / filings footer ─────────────────────────────────

function TodayFooter({ events }: { events: ReadonlyArray<CalendarEventRow> }) {
  return (
    <div
      className="mt-8 rounded-xl px-4 py-3"
      style={{ background: c.paper, border: `1px solid ${c.line}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Today's hearings &amp; filings</Eyebrow>
        <span className="text-xs" style={{ color: c.slateLight }}>
          {events.length === 0 ? "Nothing scheduled" : `${events.length} event${events.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-xs" style={{ color: c.slate }}>
          No legal-department events on the firm calendar for today.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {events.map(e => <TodayCard key={e.id} ev={e} />)}
        </div>
      )}
    </div>
  );
}

function TodayCard({ ev }: { ev: CalendarEventRow }) {
  const t = new Date(ev.start_time);
  const time = t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div
      className="shrink-0 rounded-lg px-3 py-2"
      style={{ minWidth: 220, background: c.bgWarm, border: `1px solid ${c.line}` }}
    >
      <div className="text-[10px] font-bold uppercase" style={{ color: c.slateLight, letterSpacing: "0.1em" }}>
        {ev.calendar_type.replace(/_/g, " ")}
      </div>
      <div className="text-sm font-bold mt-0.5" style={{ color: c.ink }}>
        {time} · {ev.title}
      </div>
      <div className="text-xs" style={{ color: c.slate }}>
        {ev.client_name ?? "—"} {ev.case_number ? `· ${ev.case_number}` : ""}
      </div>
    </div>
  );
}
