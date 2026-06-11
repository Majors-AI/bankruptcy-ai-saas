// Marital adjustment — Form 122A-1 line 17a.
//
// The NON-FILING SPOUSE expense deduction. For individual (non-joint)
// cases in community-property states where NFS income is INCLUDED in CMI
// per § 101(10A), the debtor may deduct on Form 122A-1 line 17a the
// portion of the NFS's income that is NOT regularly paid for the
// household's expenses — i.e. the NFS's personal expenses, separate
// debts, separate maintenance, etc. The deduction itemizes (amount +
// description); the total reduces CMI for the means-test only.
//
// CLIENTS DO NOT ENTER THIS. There is no client / intake / questionnaire
// field for it. The attorney enters and adjusts the line at the Signing
// Review surface when the case is set for attorney signing review. This
// component is mounted in SigningReview only, gated to lawyers; the
// firm-side intake surfaces never see it.
//
// Preconditions enforced by the host (SigningReview): individual filing
// (not joint) AND NFS income was included in CMI. The panel renders an
// "ineligible / N/A" notice if either precondition fails.
//
// SCAFFOLD persistence: local component state today. TODO Phase B —
// attorney_intake_reviews columns:
//   marital_adjustment_total_cents int8
//   marital_adjustment_items jsonb  -- [{amount_cents, description}]
// Plus the existing review-edit audit path (saveReviewFields).

import { useState } from "react";
import { Plus, X, AlertTriangle, Lock, Save } from "lucide-react";

export interface MaritalAdjustmentItem {
  id: string;
  amount: number;        // dollars/month
  description: string;
}

interface Props {
  /** Attorney-only gate — host (SigningReview) passes the existing lawyer
   *  flag (role === 'attorney' || 'super_admin_bankruptcy_ai'). Non-lawyers
   *  never see this panel; the host wraps the mount in the same lawyer
   *  gate that protects the rest of the Signing Review canonical surfaces. */
  isLawyer: boolean;
  /** Required precondition: must be an INDIVIDUAL case (filing_type ===
   *  "individual-nonfiling-spouse"). Joint cases don't use line 17a. */
  isIndividualWithNonFilingSpouse: boolean;
  /** Required precondition: NFS income (owner: "nfs") was included in CMI.
   *  When false the deduction is inapplicable; the panel surfaces a
   *  short "N/A" notice instead of the editor. */
  nfsIncomeIncludedInCMI: boolean;
  /** Initial line items (loaded from review record when persistence wires up). */
  initialItems?: MaritalAdjustmentItem[];
  /** Save handler — called with the full set of items + the total. The
   *  host wires this to its existing saveReviewFields-style audit path. */
  onSave?: (items: MaritalAdjustmentItem[], totalMonthly: number) => void | Promise<void>;
}

function uid(): string {
  return `madj-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export default function MaritalAdjustmentPanel({
  isLawyer, isIndividualWithNonFilingSpouse, nfsIncomeIncludedInCMI,
  initialItems = [], onSave,
}: Props) {
  const [items, setItems] = useState<MaritalAdjustmentItem[]>(initialItems);
  const [saving, setSaving] = useState(false);

  // Non-lawyer hard-stop — defense-in-depth; the host's mount gate is the
  // primary control.
  if (!isLawyer) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex items-start gap-2">
        <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          Marital adjustment (Form 122A-1 line 17a) is attorney-only. Visible to lawyers
          on the Signing Review surface.
        </p>
      </div>
    );
  }

  // Preconditions ineligible — render an N/A notice rather than an editor.
  if (!isIndividualWithNonFilingSpouse) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-300">Marital adjustment — not applicable</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Line 17a applies only to individual cases with a non-filing spouse. This case is
            joint (or has no NFS).
          </p>
        </div>
      </div>
    );
  }
  if (!nfsIncomeIncludedInCMI) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-300">Marital adjustment — not applicable</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Line 17a applies only when non-filing-spouse income was included in CMI. No NFS
            income recorded for this case.
          </p>
        </div>
      </div>
    );
  }

  function addItem() {
    setItems(prev => [...prev, { id: uid(), amount: 0, description: "" }]);
  }
  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }
  function patchItem(id: string, patch: Partial<MaritalAdjustmentItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }
  const totalMonthly = items.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave?.(items, totalMonthly);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-[#0d1221] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white">Marital adjustment — Form 122A-1 line 17a</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed max-w-2xl">
            Itemize the non-filing spouse&apos;s income that is NOT regularly paid for the
            household&apos;s expenses (NFS personal expenses, separate debts, separate
            maintenance, etc.). The total reduces CMI for the means-test only — Schedule I
            still shows the full NFS income.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-amber-300 border border-amber-500/40 rounded-full px-2 py-1">
          Attorney-only · Signing Review
        </span>
      </div>

      {/* Line items */}
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic">No marital-adjustment items recorded. Add one below.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
              <label className="block">
                <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
                  Amount ($/mo)
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={25}
                    value={item.amount}
                    onChange={e => patchItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded px-2 py-1.5 tabular-nums focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </label>
              <label className="block">
                <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
                  Description
                </span>
                <input
                  type="text"
                  value={item.description}
                  onChange={e => patchItem(item.id, { description: e.target.value })}
                  placeholder="e.g. NFS car payment / NFS student loan / NFS personal credit card"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded px-2 py-1.5 placeholder-slate-600 focus:outline-none focus:border-amber-500/60"
                />
              </label>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                title="Remove item"
                className="self-end mb-1.5 text-slate-500 hover:text-rose-400 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 border border-amber-500/40 bg-amber-500/10 rounded px-2.5 py-1 hover:bg-amber-500/20"
        >
          <Plus className="w-3 h-3" /> Add item
        </button>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400">
            Total deduction:{" "}
            <strong className="text-amber-300 tabular-nums">
              ${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 2 })}/mo
            </strong>
          </p>
          {onSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border border-amber-500 bg-amber-500/30 text-amber-100 hover:bg-amber-500/50 disabled:opacity-60"
            >
              <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-500 italic leading-snug">
        {/* TODO Phase B — persistence:
              - attorney_intake_reviews.marital_adjustment_items jsonb
              - attorney_intake_reviews.marital_adjustment_total_cents int8
              - audit on each change via the existing review-edit path */}
        Today the values live in component state. Persistence ships with the
        attorney_intake_reviews columns + the existing audit path.
      </p>
    </div>
  );
}
