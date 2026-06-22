// PaymentDataStrip — Legal client-file payment view.
//
// Companion to functional-readme §15 (Payment View & BK Forms).
// Consumes the typed interface in src/lib/legalClientPayments.ts.
//
// Renders inline near the client name on the Legal client file:
//   client name (already in parent) · amount paid · third-party name
//   (if applicable) · paid-in-full date · filing fee Y/N · process
//   stage in the process.
//
// Today the hook returns `{status: 'unwired'}`. Every field shows an
// honest pending pill — "Not yet connected" — not a fake $0 or
// placeholder name. When Canelo's §13 view lands (see schema-changes-
// for-canelo.md §13), only the hook's implementation changes; this
// component does not.

import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import {
  useLegalClientPayments,
  type LegalClientPaymentSummary,
  type HookResult,
} from "../lib/legalClientPayments";

export interface PaymentDataStripProps {
  /** Lead spine id (intake_leads.id). Null = no case selected → renders
   *  a compact empty-state row. */
  leadId: string | null | undefined;
  /** Compact mode for tight headers; default false for the full strip. */
  compact?: boolean;
}

export default function PaymentDataStrip({ leadId, compact = false }: PaymentDataStripProps) {
  const result = useLegalClientPayments(leadId);
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? "text-[10px]" : "text-xs"}`}
      role="status"
      aria-label="Client payment summary"
    >
      <StatusBanner result={result} />
      <AmountPaidCell  result={result} />
      <ThirdPartyCell  result={result} />
      <PaidInFullCell  result={result} />
      <FilingFeeCell   result={result} />
      <StageCell       result={result} />
    </div>
  );
}

// ── Status-aware sub-renderers ─────────────────────────────────────────
//
// Every cell branches on `result.status` and renders an honest empty
// state when unwired / empty / error. No fallback to $0 or placeholder
// values.

function StatusBanner({ result }: { result: HookResult<LegalClientPaymentSummary> }) {
  if (result.status === "unwired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
        style={{ background: "#FBEFDF", color: "#C2680F", border: "1px solid #EAC79B" }}
        title="The accounting payment view (schema §13) hasn't shipped yet. Every field shows its honest empty state.">
        <AlertTriangle className="w-2.5 h-2.5" /> Not yet connected
      </span>
    );
  }
  if (result.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
        style={{ background: "#0f1729", color: "#94a3b8", border: "1px solid #1e293b" }}>
        Loading…
      </span>
    );
  }
  if (result.status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
        style={{ background: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.35)" }}>
        Error — {result.error ?? "unknown"}
      </span>
    );
  }
  return null; // 'ready' / 'empty' — fields render their own state
}

function AmountPaidCell({ result }: { result: HookResult<LegalClientPaymentSummary> }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Label>Amount paid</Label>
      {result.status === "ready" && result.data ? (
        <Value>{formatUsd(result.data.amountPaidAttorneyFee)}</Value>
      ) : (
        <PendingDash />
      )}
    </span>
  );
}

function ThirdPartyCell({ result }: { result: HookResult<LegalClientPaymentSummary> }) {
  // Only renders a third-party tag when the hook is ready AND a
  // third-party payer is present. Per readme §15: "if a third party
  // paid, name them." When ready + no third party, this cell is silent.
  // When unwired/loading/error, we explicitly show that we don't know.
  if (result.status === "ready") {
    if (!result.data?.hasThirdPartyPayer) return null;
    return (
      <span className="inline-flex items-center gap-1">
        <Label>Paid by</Label>
        <Value>{result.data.thirdPartyPayerName ?? "Third party (name pending)"}</Value>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Label>Paid by</Label>
      <PendingDash />
    </span>
  );
}

function PaidInFullCell({ result }: { result: HookResult<LegalClientPaymentSummary> }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Label>Paid in full</Label>
      {result.status === "ready" && result.data ? (
        result.data.paidInFullAt ? (
          <Value>{formatDate(result.data.paidInFullAt)}</Value>
        ) : (
          <Value style={{ color: "#94a3b8" }}>Not yet</Value>
        )
      ) : (
        <PendingDash />
      )}
    </span>
  );
}

function FilingFeeCell({ result }: { result: HookResult<LegalClientPaymentSummary> }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Label>Filing fee</Label>
      {result.status === "ready" && result.data ? (
        result.data.filingFeePaid ? (
          <span className="inline-flex items-center gap-1" style={{ color: "#0E9C7A" }}>
            <CheckCircle2 className="w-3 h-3" /> Paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1" style={{ color: "#94a3b8" }}>
            <Circle className="w-3 h-3" /> Not paid
          </span>
        )
      ) : (
        <PendingDash />
      )}
    </span>
  );
}

function StageCell({ result }: { result: HookResult<LegalClientPaymentSummary> }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Label>Stage</Label>
      {result.status === "ready" && result.data ? (
        <Value>
          {result.data.matterProgression
           ?? result.data.lifecycleStatus
           ?? "Not yet recorded"}
        </Value>
      ) : (
        <PendingDash />
      )}
    </span>
  );
}

// ── Visual primitives ──────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-semibold uppercase tracking-wider text-[9px]" style={{ color: "#64748b" }}>
      {children}
    </span>
  );
}

function Value({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span className="text-xs font-semibold" style={{ color: "#FAFAF7", ...style }}>
      {children}
    </span>
  );
}

/** Honest-state placeholder. Visually distinct so a reader doesn't
 *  mistake it for a real value. Tooltip explains why. */
function PendingDash() {
  return (
    <span
      className="font-semibold text-xs"
      style={{ color: "#64748b", fontStyle: "italic" }}
      title="Source not yet connected — see schema-changes-for-canelo.md §13"
    >
      —
    </span>
  );
}

// ── Formatters ─────────────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}
