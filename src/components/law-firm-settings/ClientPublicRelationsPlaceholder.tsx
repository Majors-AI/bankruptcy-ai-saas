// Client Public Relations — placeholder page (scaffold only).
//
// Purpose: a hub for MASS MAIL-MERGE client communications — sending updates
// to all clients (case/firm updates), holiday emails, and marketing emails.
//
// ─── BUILD-OUT LATER (do not build now) ────────────────────────────────────
// Intended features when the department is built out:
//   - Mail-merge engine (variable substitution, per-recipient personalization)
//   - Template library (case-update, firm-update, holiday, marketing) with
//     versioning + approval workflow
//   - Recipient segmentation: by case stage, by department, by jurisdiction,
//     by retention status, by tag — saved segments + ad-hoc filters
//   - Send queue + scheduling (now / scheduled / drip campaigns) with
//     throttling so the firm domain isn't flagged as spam
//   - Delivery + open-rate tracking (per template, per segment)
//   - A/B subject-line testing
//   - Bounce + complaint handling — auto-suppress addresses
//   - Bulk-send dispatch (Twilio SendGrid or equivalent — TODO backend)
//   - Standard department structure once built out, matching the other
//     departments: team-by-title, tasks, per-dept strength scores, supervisor
//     assignment, department settings (hours / templates / KB), and
//     per-employee reporting.
//
// ─── COMPLIANCE TODO (in-file note for build-out) ──────────────────────────
// Mass marketing email to clients and leads is regulated. The build-out MUST
// include:
//   - Opt-out / unsubscribe link in every mass message (one-click, honored
//     within 10 business days per CAN-SPAM § 5(a)(3))
//   - Consent tracking: capture + audit the express opt-in for marketing
//     vs. transactional (case-update) communications — these are distinct
//     consent categories
//   - Attorney-advertising compliance: state bar rules govern attorney
//     advertising (e.g. AZ ER 7.1-7.3, WA RPC 7.1-7.3). Include the firm's
//     name + address; "ADVERTISING MATERIAL" tag where required; bar-rule
//     pre-approval workflow where the jurisdiction requires it
//   - CAN-SPAM Act § 5 compliance: clear from-line, non-deceptive subject,
//     physical postal address, working unsubscribe, ≤10-business-day removal,
//     no harvested addresses, no false header info
//   - Debt-relief-agency advertising compliance: 11 U.S.C. § 528 disclosures
//     ("We are a debt relief agency. We help people file for bankruptcy
//     relief under the Bankruptcy Code") on bankruptcy-related marketing
//   - Suppression list — addresses flagged for any of the above never
//     receive marketing sends; transactional still allowed only when the
//     underlying engagement is active
//   - Audit log: every send keyed by (template_id, segment_id, recipient_id,
//     consent_basis, sent_at) — discoverable on bar inquiry

import { Megaphone, Construction, MailOpen } from "lucide-react";

export default function ClientPublicRelationsPlaceholder() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border p-5" style={{ background: "var(--lfs-surface)", borderColor: "var(--lfs-border)" }}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0F0F0E] border border-[var(--lfs-border)] flex items-center justify-center">
            <Megaphone className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[#6B6B66]">Departments</p>
            <h2 className="text-base font-semibold text-[#FAFAF7]">Client Public Relations</h2>
            <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed max-w-2xl">
              Hub for mass mail-merge client communications — case + firm updates, holiday
              emails, and marketing campaigns.
            </p>
          </div>
        </div>
      </div>

      {/* To-be-built notice */}
      <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-5">
        <div className="flex items-start gap-3">
          <Construction className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-200">To be built</p>
            <p className="text-[11px] text-amber-200/80 mt-1 leading-relaxed">
              Scaffold only. The mail-merge engine, template library, recipient
              segmentation, send queue, and tracking land in a follow-up build. This
              department will also pick up the standard structure used by the others
              (team-by-title, tasks, per-department strength scores, supervisor,
              settings, and per-employee reporting).
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <PlannedBlock
                icon={<MailOpen className="w-3.5 h-3.5" />}
                title="What it will do"
                items={[
                  "Mass mail-merge with per-recipient personalization",
                  "Template library — case updates, firm updates, holiday, marketing",
                  "Recipient segmentation (by stage, jurisdiction, tags…) + saved segments",
                  "Send queue + scheduling, delivery + open-rate tracking",
                  "Bounce / complaint handling with auto-suppression",
                ]}
              />
              <PlannedBlock
                icon={<MailOpen className="w-3.5 h-3.5" />}
                title="Compliance (required at build-out)"
                items={[
                  "Opt-out / unsubscribe on every mass message + ≤10-day removal",
                  "Consent tracking — marketing vs. transactional categories",
                  "Attorney-advertising (AZ ER 7.1-7.3, WA RPC 7.1-7.3) + state-bar pre-approval where required",
                  "CAN-SPAM § 5 (clear from-line, postal address, working unsubscribe, no false headers)",
                  "Debt-relief-agency disclosures (11 U.S.C. § 528)",
                  "Suppression list + audit log keyed by template, segment, recipient, consent basis, sent_at",
                ]}
              />
            </div>

            <p className="text-[10px] text-amber-200/60 italic mt-4 leading-snug">
              Mass marketing email to clients and leads is regulated — build-out is gated
              on the compliance items above before any send is wired.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlannedBlock({
  icon, title, items,
}: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded border border-[#2A2A28] bg-[#0F0F0E] p-3">
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--lfs-accent)" }}>
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#FAFAF7]">{title}</p>
      </div>
      <ul className="text-[11px] text-[#6B6B66] leading-relaxed list-disc pl-4 space-y-0.5">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}
