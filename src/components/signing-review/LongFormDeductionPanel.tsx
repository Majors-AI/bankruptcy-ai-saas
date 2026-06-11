// Long-form means-test deductions — Form 122A-2 / 122C-2.
//
// Attorney-only surface mounted on the Signing Review next to the
// liquidation panel + marital adjustment. Renders the IRS-allowable
// deduction breakdown by category, lets the attorney override any line
// per-case (audit-logged), and surfaces the running allowable total +
// pending-data flags.
//
// Reuses:
//   - computeLongFormDeductions  (src/lib/meansTestDeductions.ts)
//   - useCaseDeductionOverrides  (src/lib/meansTestOverrides.ts)
//   - useRulesAudit              (re-review trigger via recordChange)
//   - the existing isLawyer gate (host enforces; panel re-checks)

import { useMemo } from "react";
import { useCaseDeductionOverrides, setCaseDeductionOverride } from "../../lib/meansTestOverrides";
import { computeLongFormDeductions, type DeductionEngineInput, type DeductionLine } from "../../lib/meansTestDeductions";
import { useRulesAudit } from "../law-firm-settings/rulesAuditStore";
import { AlertTriangle, Info, Lock, RotateCcw } from "lucide-react";

interface Props {
  /** Attorney-only gate — host (SigningReview) passes the existing lawyer
   *  flag. Non-lawyers see a stub notice rather than the editor. */
  isLawyer: boolean;
  caseId: string;
  formData: Record<string, unknown>;
  householdSize: number;
  state?: string | null;
  county?: string | null;
  metroOrRegion?: string | null;
  vehicleCount: number;
  /** Ch.13 only — drives the trustee-administrative line. Pass 0 for Ch.7. */
  projectedPlanPaymentMonthly?: number;
  /** CMI shown for context (read-only display). */
  cmi: number;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function LongFormDeductionPanel(props: Props) {
  if (!props.isLawyer) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex items-start gap-2">
        <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          Long-form means-test deductions (Form 122A-2 / 122C-2) are attorney-only — visible
          to lawyers on the Signing Review surface.
        </p>
      </div>
    );
  }
  return <Inner {...props} />;
}

function Inner({
  caseId, formData, householdSize, state, county, metroOrRegion, vehicleCount,
  projectedPlanPaymentMonthly, cmi,
}: Props) {
  const overrides = useCaseDeductionOverrides(caseId);
  const audit = useRulesAudit();

  const input: DeductionEngineInput = useMemo(() => ({
    formData, householdSize, state, county, metroOrRegion, vehicleCount,
    overrides, projectedPlanPaymentMonthly,
  }), [formData, householdSize, state, county, metroOrRegion, vehicleCount, overrides, projectedPlanPaymentMonthly]);

  const result = useMemo(() => computeLongFormDeductions(input), [input]);
  const dmi = Math.round((cmi - result.totalAllowableMonthly) * 100) / 100;

  function setLine(line: DeductionLine, raw: string) {
    const v = raw === "" ? null : parseFloat(raw);
    const nextValue = v == null || !Number.isFinite(v) ? null : v;
    setCaseDeductionOverride(caseId, line.path, nextValue ?? undefined);
    // Feed the audit/re-review trigger — same path-keyed entry pattern
    // used by the firm overlay + the rule pages. In-window cases
    // re-flag automatically via diffStampedVsCurrent.
    audit.recordChange({
      section: "living_standards",  // shared section key — taxonomy expand TODO
      actor: "attorney_signing_review",
      path: line.path,
      oldValue: line.effectiveValue,
      newValue: nextValue,
      source: "long-form deduction override",
    });
  }

  function resetLine(line: DeductionLine) {
    setCaseDeductionOverride(caseId, line.path, undefined);
    audit.recordChange({
      section: "living_standards",
      actor: "attorney_signing_review",
      path: line.path,
      oldValue: line.effectiveValue,
      newValue: line.standardValue,
      source: "long-form deduction override cleared",
    });
  }

  return (
    <div className="space-y-4">
      {/* Header + totals */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white">Long-form deductions — Form 122A-2 / 122C-2</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed max-w-2xl">
            IRS-allowable deduction breakdown (standards by default). Per-line attorney
            override is audit-logged and feeds the existing re-review trigger when an
            in-window case is stamped against a prior ruleset version. Pending lines
            are excluded from the total until loaded — see the gap notes below.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-widest text-amber-300">Allowable monthly total</p>
          <p className="text-base font-bold text-amber-100 tabular-nums">{fmt(result.totalAllowableMonthly)}</p>
          <p className="text-[10px] text-amber-200/70 mt-1">
            CMI <span className="tabular-nums">{fmt(cmi)}</span> − allowable
            <span className="tabular-nums"> {fmt(result.totalAllowableMonthly)}</span> = DMI
            <strong className={`tabular-nums ml-1 ${dmi > 0 ? "text-red-300" : "text-emerald-300"}`}>{fmt(dmi)}</strong>
          </p>
        </div>
      </div>

      {/* Pending data banner */}
      {result.pendingLines.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200 leading-relaxed">
            <strong className="text-amber-300">{result.pendingLines.length} line{result.pendingLines.length === 1 ? "" : "s"} pending data load.</strong>{" "}
            These lines are excluded from the allowable total until the store loads
            (IRS out-of-pocket health-care, per-child education cap, charitable %, the
            Ch.13 trustee % schedule, and non-AZ/WA counties). Attorney can enter a
            per-case value as an override.
          </div>
        </div>
      )}

      {/* Categories */}
      {result.categories.map(cat => (
        <div key={cat.key} className="rounded-xl border border-slate-700 bg-[#0d1221] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/50">
            <p className="text-xs font-bold text-white">{cat.label}</p>
            <p className="text-[10px] text-slate-500">{cat.citation}</p>
          </div>
          <ul className="divide-y divide-slate-800">
            {cat.lines.map(line => (
              <LineRow
                key={line.path}
                line={line}
                onSet={(raw) => setLine(line, raw)}
                onReset={() => resetLine(line)}
                hasOverride={overrides.has(line.path)}
              />
            ))}
          </ul>
        </div>
      ))}

      <p className="text-[10px] text-slate-500 italic leading-snug">
        {/* TODO Phase B — persistence:
              - attorney_intake_review_deductions (review_id, path,
                value_cents, set_by_user_id, set_at)
              - audit via the existing review-edit path
              - server-side guard: reject writes from non-lawyer roles */}
        Today the overrides live in memory + per-tab localStorage. Persistence + audit
        ship with the attorney_intake_review_deductions table.
      </p>
    </div>
  );
}

function LineRow({
  line, onSet, onReset, hasOverride,
}: {
  line: DeductionLine;
  onSet: (raw: string) => void;
  onReset: () => void;
  hasOverride: boolean;
}) {
  return (
    <li className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_auto] gap-3 items-start">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{line.label}</p>
        <p className="text-[10px] text-slate-500">{line.citation}</p>
        {line.note && (
          <p className="text-[10px] text-slate-400 italic mt-0.5 leading-snug">
            <Info className="w-3 h-3 inline mr-1 text-slate-500" />{line.note}
          </p>
        )}
        {line.gap && (
          <p className="text-[10px] text-amber-300 mt-0.5 leading-snug">
            <AlertTriangle className="w-3 h-3 inline mr-1" />Pending: {line.gap}
          </p>
        )}
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">Standard</p>
        <p className="text-xs text-slate-300 tabular-nums">{fmt(line.standardValue)}</p>
        {line.actualValue != null && line.actualValue !== line.standardValue && (
          <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
            Actual: {fmt(line.actualValue)}
          </p>
        )}
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">
          Effective {hasOverride && <span className="text-amber-400 ml-1">∆ override</span>}
        </p>
        <input
          type="number"
          step={1}
          value={line.effectiveValue ?? ""}
          placeholder={line.pending ? "—" : String(line.standardValue ?? "")}
          onChange={e => onSet(e.target.value)}
          className={`w-full bg-slate-800 border text-white text-xs rounded px-2 py-1 tabular-nums text-right ${hasOverride ? "border-amber-500/60" : "border-slate-700"}`}
        />
      </div>
      {hasOverride && (
        <button
          type="button"
          onClick={onReset}
          title="Reset to IRS standard"
          className="self-center text-slate-500 hover:text-amber-300 p-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  );
}
