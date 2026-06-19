// FormDataInventory — Prompt 84 (expanded).
//
// Read-only inventory of every captured intake field for the selected lead.
// Reuses ALL_ANSWERS_SCHEMA from AllAnswersView for the filing-document
// grouping + question labels, then renders honest values for every schema
// field AND surfaces any extra top-level form_data key the schema doesn't
// yet cover under a final "Other captured fields" section.
//
// Source of truth for the data: intake_submissions.form_data (JSONB column
// on the intake_submissions table — see LegalAdminPortal.tsx:3322 for the
// fetch path). The locked questionnaire JSX writes there but the read is
// independent — this view never touches the locked file.
//
// Honest-value rules:
//   - null / undefined / "" → neutral em-dash placeholder ("—")
//   - booleans (true/false, "yes"/"no", "true"/"false") → "Yes" / "No"
//   - ISO timestamps → formatted in FIRM_TZ
//   - Arrays → indented sub-list, one entry per row
//   - Objects → indented key/value sub-list (no raw JSON dump)
//   - Long values wrap; never silently truncated
//
// Strictly read-only. No inputs, no edit/save affordances, no writes.
// Inline editing arrives with the review/edit view — see TODO at the
// footer of the component for the placeholder ticket reference.

import { useMemo, type ReactNode } from "react";
import { ClipboardList, FileText } from "lucide-react";
import {
  ALL_ANSWERS_SCHEMA,
  renderAnswerValue,
  type AllAnswersField,
  type AllAnswersSection,
} from "../intake-review/AllAnswersView";
import {
  Card, CardHeader, CountBadge, EmptyHint,
  FIRM_TZ,
} from "../department-dashboard";

const BLANK = "—";

/** ISO timestamp detector — matches 2026-06-15T12:34:00Z and friends.
 *  Plain date-only strings (YYYY-MM-DD) are also accepted and rendered
 *  without time. Used by the recursive value renderer so a nested
 *  `acquiredDate` field reads as "Jun 15, 2026" rather than a raw ISO. */
function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(s);
}

function fmtIsoInFirmTz(s: string): string {
  // Date-only (no T-component) → just the date in firm tz.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(dateOnly ? s + "T12:00:00Z" : s);
  if (Number.isNaN(d.getTime())) return s;
  if (dateOnly) {
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: FIRM_TZ,
    });
  }
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: FIRM_TZ,
  });
}

/** Boolean-ish detector — accepts the literal `boolean` plus "yes"/"no"
 *  string variants the locked questionnaire emits. */
function asBool(v: unknown): boolean | null {
  if (v === true || v === "yes" || v === "true") return true;
  if (v === false || v === "no" || v === "false") return false;
  return null;
}

/** Recursive value renderer — handles scalars, ISO dates, booleans, and
 *  nested objects/arrays. Returns a ReactNode (a span for inline values,
 *  a list for nested structures). The `depth` arg caps recursion so a
 *  pathological circular structure can't blow the stack. */
function RenderValue({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (depth > 5) {
    return <span className="text-slate-500 italic" title="Nested too deep — truncated for display">(deeper structure)</span>;
  }
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-600 italic">{BLANK}</span>;
  }
  const b = asBool(value);
  if (b !== null) {
    return <span className="text-slate-200">{b ? "Yes" : "No"}</span>;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return <span className="text-slate-600 italic">{BLANK}</span>;
    if (isIsoDate(trimmed)) return <span className="font-mono text-slate-300">{fmtIsoInFirmTz(trimmed)}</span>;
    return <span className="text-slate-200 whitespace-pre-wrap break-words">{trimmed}</span>;
  }
  if (typeof value === "number") {
    return <span className="font-mono tabular-nums text-slate-200">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500 italic">None reported</span>;
    }
    return (
      <ul className="space-y-1.5 mt-1">
        {value.map((item, i) => (
          <li key={i} className="pl-3 border-l border-slate-700/60">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">
              Item {i + 1}
            </p>
            <RenderValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-slate-500 italic">No fields</span>;
    }
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 mt-1">
        {entries.map(([k, v]) => (
          <ObjectRow key={k} k={k} v={v} depth={depth + 1} />
        ))}
      </dl>
    );
  }
  // Fallback — unknown type. Stringify but flag.
  return <span className="font-mono text-slate-400">{String(value)}</span>;
}

function ObjectRow({ k, v, depth }: { k: string; v: unknown; depth: number }) {
  return (
    <>
      <dt className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{k}</dt>
      <dd className="text-[11px] text-slate-200">
        <RenderValue value={v} depth={depth} />
      </dd>
    </>
  );
}

/** Schema field renderer — for fields we know about via ALL_ANSWERS_SCHEMA.
 *  Uses the schema's `question` (or label) above the answer so the reviewer
 *  sees what was actually asked. Routes through `renderAnswerValue` for
 *  format-aware text (money/yesNo/date/text); arrays + objects fall back
 *  to the recursive RenderValue. */
function SchemaFieldRow({ field, fd }: { field: AllAnswersField; fd: Record<string, unknown> }) {
  const v = fd[field.key];

  // Array-shaped schema fields (multi) — use the recursive renderer so
  // each item's properties get the indented-list treatment.
  if (field.format === "multi") {
    return (
      <div className="py-2 border-b border-slate-800/60 last:border-b-0">
        <p className="text-[11px] text-slate-400 mb-1">
          <span className="font-semibold text-slate-300">{field.label}</span>
          {field.question ? <span className="text-slate-500"> — {field.question}</span> : null}
        </p>
        <RenderValue value={v ?? []} />
      </div>
    );
  }

  // Scalar — use renderAnswerValue for format hints, then wrap blanks
  // with the neutral em-dash placeholder.
  const { text, isBlank } = renderAnswerValue(v, field.format);
  return (
    <div className="py-2 border-b border-slate-800/60 last:border-b-0">
      <p className="text-[11px] text-slate-400 mb-1">
        <span className="font-semibold text-slate-300">{field.label}</span>
        {field.question ? <span className="text-slate-500"> — {field.question}</span> : null}
      </p>
      {isBlank
        ? <p className="text-[11px] text-slate-600 italic">{BLANK}</p>
        : field.format === "date"
          ? <p className="text-[11px] font-mono text-slate-300">{fmtIsoInFirmTz(text)}</p>
          : <p className="text-[11px] text-slate-200 whitespace-pre-wrap break-words">{text}</p>}
    </div>
  );
}

function SchemaSectionPanel({ section, fd }: { section: AllAnswersSection; fd: Record<string, unknown> }) {
  // A section is "not yet captured" only when none of its fields have a
  // value at all in fd. Even a single populated field flips the section
  // to "in progress" rather than empty.
  const anyPresent = useMemo(
    () => section.fields.some(f => {
      const v = fd[f.key];
      if (v == null || v === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }),
    [section.fields, fd]
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="px-4 py-2.5 border-b border-slate-800/60">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">{section.title}</p>
        {section.documentNote && (
          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{section.documentNote}</p>
        )}
      </div>
      {anyPresent ? (
        <div className="px-4 py-1">
          {section.fields.map(f => (
            <SchemaFieldRow key={f.key} field={f} fd={fd} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="text-[11px] text-slate-500 italic">
            Not yet captured — this section has no answers on file for the selected lead.
          </p>
        </div>
      )}
    </div>
  );
}

function OtherFieldsPanel({ keys, fd }: { keys: string[]; fd: Record<string, unknown> }) {
  if (keys.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="px-4 py-2.5 border-b border-slate-800/60">
        <p className="text-[11px] font-bold uppercase tracking-widest text-sky-300">
          Other captured fields
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
          Top-level <code className="text-slate-400">form_data</code> keys present on this submission
          that the curated schema doesn't (yet) group under a filing document. Listed
          here so nothing the client submitted is hidden from review.
        </p>
      </div>
      <div className="px-4 py-3">
        <dl className="grid grid-cols-1 sm:grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-2">
          {keys.map(k => (
            <ObjectRow key={k} k={k} v={fd[k]} depth={0} />
          ))}
        </dl>
      </div>
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────

export interface FormDataInventoryProps {
  /** The intake_submissions.form_data JSONB blob for the selected lead. */
  fd: Record<string, unknown>;
  /** Header title. Defaults to "Captured Intake Data". */
  title?: string;
  /** Optional one-line subtitle under the title. */
  subtitle?: string;
}

export default function FormDataInventory({
  fd, title = "Captured Intake Data", subtitle,
}: FormDataInventoryProps) {
  // Collect every schema-known key so the "Other captured fields" list can
  // surface anything beyond. Multi-field item shapes are tracked too — the
  // schema only declares the parent key, so we don't need to dive in here.
  const schemaKeys = useMemo(() => {
    const out = new Set<string>();
    ALL_ANSWERS_SCHEMA.forEach(sec => sec.fields.forEach(f => out.add(f.key)));
    return out;
  }, []);

  const extraKeys = useMemo(
    () => Object.keys(fd ?? {}).filter(k => !schemaKeys.has(k)).sort(),
    [fd, schemaKeys]
  );

  const totalCount = useMemo(() => {
    let n = 0;
    ALL_ANSWERS_SCHEMA.forEach(sec => { n += sec.fields.length; });
    return n + extraKeys.length;
  }, [extraKeys]);

  // Safe-guard: if fd is empty / missing, render an honest empty state.
  const hasAnyData = fd && Object.keys(fd).length > 0;

  return (
    <Card>
      <CardHeader
        icon={<ClipboardList className="w-4 h-4" />}
        title={title}
        badge={<CountBadge value={totalCount} />}
      />
      <div className="p-4 space-y-3">
        {subtitle && (
          <p className="text-[11px] text-slate-400 leading-relaxed">{subtitle}</p>
        )}

        {!hasAnyData ? (
          <EmptyHint>
            No captured intake data on file for this lead yet.
          </EmptyHint>
        ) : (
          <>
            {ALL_ANSWERS_SCHEMA.map(sec => (
              <SchemaSectionPanel key={sec.id} section={sec} fd={fd} />
            ))}
            <OtherFieldsPanel keys={extraKeys} fd={fd} />
          </>
        )}

        <p className="text-[10px] text-slate-500 italic leading-snug pt-2 border-t border-slate-800/60 flex items-start gap-2">
          <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Strictly read-only. Inline editing arrives with the review/edit view.
            {/* TODO <edit-view ticket — next in queue; insert the real BAN # when the
                 edit-view scope is filed>. Until that lands, all corrections go
                 through the locked client questionnaire or the existing per-section
                 "request additional information" flow in AllAnswersView. */}
          </span>
        </p>
      </div>
    </Card>
  );
}
