// Law Firm Owner Portal — page 20 in the Intake Portal nav.
//
// Hierarchy:
//   Law Firm Owner ⊃ Super Admin ⊃ Attorney
//
// The Owner sees EVERYTHING the Law Firm Settings exposes (firm
// settings, feature toggles, staff & roles) PLUS owner-only sections:
//   - Accounting reporting (firm-wide P&L, AR, trust account oversight)
//   - Productivity reporting (firm-wide rollup across staff)
//   - Grant features to Super Admin (default OFF — owner decides which
//     owner-only sections the super-admin can access)
//
// SCAFFOLD ONLY. Subsection list is frozen. No data fetching, no real toggles,
// no DB writes. Wires up in the follow-up build.
//
// Distinct from the bankruptcy.ai Admin platform-operator console. This is
// firm-internal — the owner of a single law firm managing their own firm.

import { useState } from "react";
import {
  Crown, Building2, ToggleLeft, Users, BarChart3, Coins, KeyRound, Info, Scale, Network,
} from "lucide-react";
import LegalReferenceStore from "./components/legal-reference/LegalReferenceStore";
import DepartmentManagement from "./components/department-management/DepartmentManagement";

interface LawFirmOwnerPortalProps {
  /** True when the current viewer is the firm's law-firm-owner role. */
  isLawFirmOwner: boolean;
}

export default function LawFirmOwnerPortal({ isLawFirmOwner }: LawFirmOwnerPortalProps) {
  // Per-feature grants the Owner can give to the firm's Super Admin. All
  // default OFF — the Owner has to opt in to share each capability. In the
  // scaffold these are local state only; real persistence lands in the
  // follow-up build (likely firm_owner_grants table).
  const [grants, setGrants] = useState<Record<string, boolean>>({
    accounting_reporting: false,
    productivity_reporting: false,
    payroll_settings: false,
    billing_subscription: false,
  });

  if (!isLawFirmOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-100 p-8" style={{ background: "#0F0F0E" }}>
        <div className="max-w-md text-center">
          <Crown className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-[#FAFAF7] mb-2">Law Firm Owner Portal</h1>
          <p className="text-sm text-[#6B6B66] leading-relaxed">
            This portal is restricted to the firm's owner role. Super-admins do not see this portal by default;
            the owner can grant specific owner-only features to a super-admin from inside this portal.
          </p>
          <p className="mt-4 text-[10px] text-[#6B6B66] italic">
            Different from <span className="text-[#FAFAF7] font-semibold">bankruptcy.ai Admin</span> —
            that's the platform-operator console managed by the bankruptcy.ai team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100" style={{ background: "#0F0F0E" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 px-6 flex items-center"
        style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28" }}
      >
        <Crown className="w-4 h-4 text-[#B8945F] mr-2" />
        <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          Law Firm Owner Portal
        </span>
        <span className="ml-2 text-[10px] uppercase tracking-widest text-[#6B6B66]">firm owner · scaffold</span>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8 lg:py-10 space-y-6">
        <ScaffoldBanner />

        {/* ── Inherited from Law Firm Settings ──────────────────── */}
        <SectionGroup
          label="Law Firm Settings capabilities"
          sublabel="Everything the firm's super-admin sees, plus the owner-only sections below."
        >
          <Subsection
            icon={<Building2 className="w-4 h-4 text-[#B8945F]" />}
            title="Firm settings"
            subtitle="Firm-wide config — display name, timezone, default consult modality, business hours, branding."
          >
            <ComingSoon note="Reads / writes against firms + firm_branding + firm_communications_config." />
          </Subsection>

          <Subsection
            icon={<ToggleLeft className="w-4 h-4 text-[#B8945F]" />}
            title="Feature toggles"
            subtitle="Per-firm enable / disable for nav-level features. Drives Intake Portal nav visibility."
          >
            <ComingSoon note="Toggle list backed by firm_features. Productivity is currently hosted inside the Law Firm Settings." />
          </Subsection>

          <Subsection
            icon={<Users className="w-4 h-4 text-[#B8945F]" />}
            title="Staff & roles"
            subtitle="Add, deactivate, and assign intake-portal roles + PINs for firm staff."
          >
            <ComingSoon note="CRUD on staff_members + intake_portal_role assignment. Today managed manually via SQL / Supabase dashboard." />
          </Subsection>

          {/* Legal Reference / Rules & Standards — shared store. Identical
              component mounts in Department Settings and Super Admin Setting
              Portal. The Law Firm Owner has full edit rights system-wide. */}
          <Subsection
            icon={<Scale className="w-4 h-4 text-[#B8945F]" />}
            title="Legal Reference / Rules & Standards"
            subtitle="IRS standards, state exemptions, means-test thresholds, and cited statutory parameters. Edits propagate everywhere."
          >
            <LegalReferenceStore
              viewerStaffRole="law_firm_owner"
              surfaceName="law_firm_owner"
            />
          </Subsection>

          {/* Department Management — same surface the super admin sees, but
              the owner can configure approval gates (owner-only). */}
          <Subsection
            icon={<Network className="w-4 h-4 text-[#B8945F]" />}
            title="Department Management"
            subtitle="Departments + staff roster + per-department panels + auto-assign + approval gates + audit log + Collections shell. Owner can configure approval gates."
          >
            <DepartmentManagement viewerRole="law_firm_owner" />
          </Subsection>
        </SectionGroup>

        {/* ── Owner-only sections ────────────────────────────────────────── */}
        <SectionGroup
          label="Owner-only"
          sublabel="Default-hidden for the super-admin. Use the access-grant toggles below to share any of these."
        >
          <Subsection
            icon={<Coins className="w-4 h-4 text-[#B8945F]" />}
            title="Accounting reporting"
            subtitle="Firm-wide financial rollup — revenue, AR aging, IOLTA trust balances, fee adjustments, autopay cadence."
            ownerOnly
          >
            <ComingSoon note="Future surface: P&L, AR aging, trust-account ledger by client, fee-adjustment requests queue, autopay success/failure trends. Aggregates from accounting_* + client_card_payments." />
          </Subsection>

          <Subsection
            icon={<BarChart3 className="w-4 h-4 text-[#B8945F]" />}
            title="Productivity reporting"
            subtitle="Firm-wide staff productivity rollup — completion rates, response times, client contacts handled, behavior notes."
            ownerOnly
          >
            <ComingSoon note="Aggregates staff_productivity_log + staff_daily_tasks + staff_behavior_notes per staffer over selectable date ranges. Compares staffers in the same role band." />
          </Subsection>

          <Subsection
            icon={<KeyRound className="w-4 h-4 text-[#B8945F]" />}
            title="Grant features to Super Admin"
            subtitle="Owner controls which owner-only capabilities the firm's super-admin can access. Every grant defaults OFF."
            ownerOnly
          >
            <div className="space-y-2">
              {([
                ["accounting_reporting",   "Accounting reporting"],
                ["productivity_reporting", "Productivity reporting"],
                ["payroll_settings",       "Payroll settings (future)"],
                ["billing_subscription",   "Billing & subscription (future)"],
              ] as const).map(([key, label]) => {
                const on = grants[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-[#2A2A28] bg-[#0F0F0E] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#FAFAF7]">{label}</p>
                      <p className="text-[10px] text-[#6B6B66] mt-0.5">
                        Default {on ? "ON" : "OFF"} — {on ? "super-admin can access this section" : "owner-only until enabled here"}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGrants(g => ({ ...g, [key]: !g[key] }))}
                      title="Scaffold — toggle is local state only; real persistence lands in the follow-up build"
                      className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${
                        on
                          ? "bg-emerald-700/40 border-emerald-600 text-emerald-100"
                          : "bg-[#1A1A18] border-[#2A2A28] text-[#6B6B66] hover:border-[#B8945F]/60"
                      }`}
                    >
                      {on ? "Granted" : "Off"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] text-[#6B6B66] italic">
              Toggles are local-state only in the scaffold. Real persistence + enforcement (the super-admin's
              Law Firm Settings honoring these grants) lands in the follow-up build.
            </p>
          </Subsection>
        </SectionGroup>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScaffoldBanner() {
  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3.5">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-300">Coming soon — scaffold only</p>
          <p className="text-[11px] text-amber-200/80 mt-0.5">
            Owner-tier portal. Inherits everything from the Law Firm Settings (#19) plus owner-only sections
            below. The "Grant features to Super Admin" controls decide what the super-admin sees in their portal;
            every grant defaults OFF.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionGroup({ label, sublabel, children }: {
  label: string;
  sublabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="pl-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#B8945F]">{label}</p>
        <p className="text-[11px] text-[#6B6B66] mt-0.5">{sublabel}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Subsection({ icon, title, subtitle, ownerOnly, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ownerOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0F0F0E] border border-[#2A2A28] flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#FAFAF7]">{title}</h3>
            {ownerOnly && (
              <span className="text-[9px] uppercase tracking-widest text-[#B8945F] font-semibold">
                owner only
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 pl-11">{children}</div>
    </section>
  );
}

function ComingSoon({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] px-3 py-3">
      <p className="text-xs font-semibold text-[#6B6B66] uppercase tracking-widest mb-1">Coming soon</p>
      <p className="text-[11px] text-[#6B6B66] leading-relaxed">{note}</p>
    </div>
  );
}
