// Department Settings — surfaced in the Intake Admin Portal as a top-level
// left-nav tab alongside Staff Settings. Visible to super admins and
// department supervisors. SCAFFOLD ONLY today; persistence + ingestion
// wires in the follow-up build.
//
// Sections rendered here:
//   1. Intake form copy overrides
//      - intro statements per step
//      - question-wording overrides
//      - NEVER allows removing a question (only rewording)
//   2. Intake feature toggles
//      - "Enable IRS Standards auto-fill on the Expenses step" Y/N
//        (attorneys at some firms prefer that clients disclose actuals
//         instead of pre-populating standards)
//   3. IRS Standards & State Exemptions edit links
//      - DISABLED for non-lawyers; only attorney + super admin (or law
//        firm owner) can edit standards / exemptions / AI prompts
//   4. AI prompt overrides
//      - DISABLED for non-lawyers
//
// Every save in this panel triggers a notification to the Law Firm Owner
// ("Law firm settings adjustment"). Today this is a stub — wire to the
// firm_settings_audit_log + owner_notifications tables in the follow-up
// build.

import { Shield, Lock, FileText, ToggleLeft, ToggleRight, Bell, Edit3, Upload, Scale } from "lucide-react";
import LegalReferenceStore, { type LegalReferenceViewerRole } from "../legal-reference/LegalReferenceStore";

export type DepartmentSettingsViewerRole =
  | "super_admin"
  | "attorney_super_admin"
  | "department_supervisor"
  | "law_firm_owner"
  | "none";

interface Props {
  viewerStaffRole: DepartmentSettingsViewerRole;
  viewerDepartment?: string | null;
  // Optional initial values. The component is presentational today — saves
  // are scaffold (logged + would-notify-owner). Real persistence lives in
  // department_settings + firm_settings_audit_log.
  initialEnableIrsAutoFill?: boolean;
  initialEnablePiScreening?: boolean;
}

export default function DepartmentSettingsPanel({
  viewerStaffRole,
  viewerDepartment,
  initialEnableIrsAutoFill = true,
  initialEnablePiScreening = false,
}: Props) {
  // Permission: only lawyers with super-admin role + the firm owner can
  // edit standards / exemptions / AI prompts. Department supervisors who
  // aren't lawyers see these surfaces but they're disabled.
  const canEditRulesAndStandards =
    viewerStaffRole === "attorney_super_admin" || viewerStaffRole === "law_firm_owner";
  const isOwner = viewerStaffRole === "law_firm_owner";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-bold text-white">Department Settings</h2>
          <p className="text-sm text-slate-400 leading-relaxed mt-1">
            Adjust how the <strong className="text-amber-400">intake form</strong>, <strong className="text-amber-400">expense auto-fill</strong>, and per-firm <strong className="text-amber-400">standards / exemptions</strong> behave for your firm
            {viewerDepartment ? <> — scoped to <strong className="text-amber-400">{viewerDepartment}</strong></> : ""}.
          </p>
        </div>
        {!canEditRulesAndStandards && (
          <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Read-only sections
          </span>
        )}
      </div>

      {/* Owner-notification banner */}
      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-2.5">
        <Bell className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-200 leading-relaxed">
          <strong className="text-blue-300">Changes here notify the Law Firm Owner.</strong> Every save is logged as a "Law firm settings adjustment" and surfaces in the owner's notifications on next sign-in.
        </p>
      </div>

      {/* ─── 1. Intake Form Copy Overrides ─────────────────────────────────── */}
      <section className="rounded-xl border border-slate-700 bg-[#0d1221] p-5">
        <div className="flex items-start gap-3 mb-3">
          <FileText className="w-4 h-4 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Intake Form Copy</h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Reword the intro statements and individual question labels to match your firm's voice. <strong className="text-amber-400">You cannot remove questions</strong> — only change the wording.
            </p>
          </div>
        </div>

        <div className="space-y-3 ml-7">
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
            <p className="text-xs font-semibold text-slate-300 mb-1.5">Welcome page intro</p>
            <textarea
              placeholder="Default copy is shown to clients today. Enter an override to replace it. Leave blank to use the platform default."
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
            />
            <p className="mt-1.5 text-[10px] text-slate-500 italic">Wire-up pending — saves persist to <code className="text-amber-400">department_form_overrides</code>.</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
            <p className="text-xs font-semibold text-slate-300 mb-1.5">Step intro statements (per step)</p>
            <p className="text-xs text-slate-400 mb-2">Override the explanation card at the top of any step (Filing Type, Household, Income, etc.).</p>
            <button type="button" disabled className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline">
              Manage step intros →
            </button>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
            <p className="text-xs font-semibold text-slate-300 mb-1.5">Question wording overrides</p>
            <p className="text-xs text-slate-400 mb-2">Change how any question is phrased. The underlying field stays the same — only the label / hint differs.</p>
            <button type="button" disabled className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline">
              Browse intake fields →
            </button>
            <p className="mt-1.5 text-[10px] text-slate-500 italic">
              Wired to <code className="text-amber-400">firmConfig.customHelp</code> — keyed by field name. Already plumbed into <code className="text-amber-400">BankruptcyIntake</code>.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 2. Intake Feature Toggles ─────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-700 bg-[#0d1221] p-5">
        <div className="flex items-start gap-3 mb-3">
          <ToggleLeft className="w-4 h-4 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Intake Feature Toggles</h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Turn intake features on or off without touching code.</p>
          </div>
        </div>

        <div className="space-y-2 ml-7">
          <div className={`rounded-lg border ${canEditRulesAndStandards ? "border-slate-700" : "border-slate-800"} bg-slate-900/40 p-3 flex items-start gap-3`}>
            {initialEnableIrsAutoFill ? <ToggleRight className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" /> : <ToggleLeft className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="text-xs font-semibold text-white">IRS Standards auto-fill on the Expenses step</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                When enabled, clients see a "Use IRS standard amounts" button on the Expenses step that pre-fills food / housekeeping / utilities / clothing / personal care / gas / vehicle insurance based on the IRS National + Local Standards for their household size and county.
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                <strong className="text-amber-400">Off</strong> = clients must disclose their actual amounts manually (some firms prefer this so the trustee sees real spend, not standards).
              </p>
            </div>
            <button type="button" disabled={!canEditRulesAndStandards}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline whitespace-nowrap">
              {initialEnableIrsAutoFill ? "Disable" : "Enable"}
            </button>
          </div>

          {/* Personal Injury Screening toggle — hides the entire PI step
              when off. Firms that don't take PI referrals can turn this
              off so clients don't see a question that doesn't apply. */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 flex items-start gap-3">
            {initialEnablePiScreening ? <ToggleRight className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" /> : <ToggleLeft className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="text-xs font-semibold text-white">Personal Injury Screening step in intake form</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                When enabled, clients are asked at the end of intake whether they may have a personal injury or accident claim and (if yes) the incident details are collected for separate attorney review.
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                <strong className="text-amber-400">Off</strong> = the PI step is skipped entirely. Use this if your firm doesn't take PI referrals or routes those leads through a different intake.
              </p>
            </div>
            <button type="button"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline whitespace-nowrap">
              {initialEnablePiScreening ? "Disable" : "Enable"}
            </button>
          </div>

          {!canEditRulesAndStandards && (
            <p className="text-[11px] text-slate-500 italic flex items-center gap-1.5 ml-7">
              <Lock className="w-3 h-3 text-slate-500" /> Some toggles are restricted to attorneys with super-admin or the law firm owner.
            </p>
          )}
        </div>
      </section>

      {/* ─── 3. Legal Reference / Rules & Standards (shared store) ──────────
          One source of truth — same component mounts in Super Admin and Law
          Firm Owner portals. Attorneys edit; non-lawyers view + propose. */}
      <section className="rounded-xl border border-slate-700 bg-[#0d1221] p-5">
        <LegalReferenceStore
          viewerStaffRole={viewerStaffRole as LegalReferenceViewerRole}
          surfaceName="department_settings"
        />
      </section>

      {/* ─── 4. Disclosures & Consent Text ──────────────────────────────── */}
      <section className="rounded-xl border border-slate-700 bg-[#0d1221] p-5">
        <div className="flex items-start gap-3 mb-3">
          <FileText className="w-4 h-4 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Disclosures & Consent Text</h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Customize the certification and TCPA-style SMS/email consent text that clients see on the final Review &amp; Submit step. Use <code className="text-amber-400">{`{firmName}`}</code> as a placeholder — it gets replaced with the firm name automatically.
            </p>
          </div>
        </div>

        <div className="space-y-3 ml-7">
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
            <p className="text-xs font-semibold text-slate-300 mb-1.5">Certification checkbox text</p>
            <textarea
              placeholder={'Default: "I certify that all information is true, correct, and complete. I understand this does not constitute legal advice or create an attorney-client relationship."'}
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
            <p className="text-xs font-semibold text-slate-300 mb-1.5">SMS / email consent text (TCPA-aligned)</p>
            <textarea
              placeholder={'Default: "By submitting this form, I agree that {firmName} and its staff may contact me by phone call, text message (including automated and AI-assisted texts), and email at the phone number and email address I provide, to schedule and handle my intake. Message and data rates may apply. I can reply STOP at any time to opt out of texts. Consent is not a condition of receiving legal services."'}
              rows={5}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          <p className="text-[11px] text-slate-500 italic">
            Wire-up pending — saves persist to <code className="text-amber-400">department_consent_text</code> and feed <code className="text-amber-400">firmConfig.certificationText</code> + <code className="text-amber-400">firmConfig.smsConsentText</code> at render time. Test with the firm's actual name in <code className="text-amber-400">{`{firmName}`}</code> before publishing.
          </p>
        </div>
      </section>

      {/* ─── 5. AI Prompts ─────────────────────────────────────────────────── */}
      <section className={`rounded-xl border ${canEditRulesAndStandards ? "border-slate-700" : "border-slate-800"} bg-[#0d1221] p-5`}>
        <div className="flex items-start gap-3 mb-3">
          <FileText className="w-4 h-4 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              AI Assistant Prompts
              {!canEditRulesAndStandards && (
                <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Attorney + Super Admin only
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Customize the AI assistant's behavior across intake chat, draft replies, and case-review prompts.
            </p>
          </div>
        </div>
        <div className="ml-7">
          <button type="button" disabled={!canEditRulesAndStandards}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline">
            Manage prompts →
          </button>
          <p className="mt-1.5 text-[10px] text-slate-500 italic">
            Wired to <code className="text-amber-400">firm_ai_scripts</code> (already scaffolded in the Super Admin Portal).
          </p>
        </div>
      </section>

      {/* Save scaffold + owner-notification reminder */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex items-center justify-between">
        <p className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-amber-400">Heads up:</strong> Saving any change here triggers a <strong className="text-white">"Law firm settings adjustment"</strong> notification to the firm owner.
        </p>
        <button type="button" disabled
          className="text-xs font-semibold bg-amber-400/10 border border-amber-400/40 text-amber-400 hover:bg-amber-400/20 hover:border-amber-400 px-3 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          Save all changes
        </button>
      </div>
      {isOwner && (
        <p className="text-[11px] text-slate-500 italic">
          You're viewing this as the <strong className="text-amber-400">Law Firm Owner</strong> — your saves don't notify yourself, but each one is still logged for audit.
        </p>
      )}
    </div>
  );
}
