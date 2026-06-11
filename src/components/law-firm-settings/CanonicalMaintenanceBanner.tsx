// Shared banner for canonical legal-reference datasets — surfaced on
// every dataset that is maintained by Bankruptcy.AI (not firm-editable):
// Bankruptcy Exemptions, Median Income, IRS Living Standards (canonical
// layer), Local Rules, means-test inputs.
//
// Wording is intentionally affirmative ("Maintained by …") rather than
// negative ("you can't edit this") — the firm sees a stable, sourced
// dataset and trusts the operator to keep it current. The version +
// updated-on metadata anchors a re-review event the moment the operator
// publishes a bump (handled by the rulesAuditStore.recordChange path).

import { ShieldCheck } from "lucide-react";

interface Props {
  /** Human label for the dataset (e.g. "Bankruptcy Exemptions"). */
  datasetLabel: string;
  /** Effective version label. */
  version: string;
  /** Last update timestamp / publication date. */
  updatedOn: string;
  /** Whether the dataset is unverified (existing attorney-verification flag). */
  unverified?: boolean;
}

export default function CanonicalMaintenanceBanner({
  datasetLabel, version, updatedOn, unverified,
}: Props) {
  return (
    <div className="rounded-xl border border-sky-700/40 bg-sky-950/20 px-4 py-3 flex items-start gap-3 flex-wrap">
      <ShieldCheck className="w-4 h-4 text-sky-300 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-sky-100">
          Maintained by Bankruptcy.AI — {datasetLabel}
        </p>
        <p className="text-[11px] text-sky-200/80 mt-0.5 leading-relaxed">
          Read-only at the firm level. <strong>v{version}</strong>, updated{" "}
          <strong>{updatedOn}</strong>. Updates publish from the platform operator and
          trigger pre-filing re-review for any in-window attorney-reviewed cases.
        </p>
        {unverified && (
          <p className="text-[10px] uppercase tracking-widest text-amber-300 mt-1">
            Not yet attorney-verified — verify before relying on individual rows.
          </p>
        )}
      </div>
    </div>
  );
}
