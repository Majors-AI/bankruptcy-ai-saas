// Super Admin Setting Portal — FIRM-FACING platform-adjustment console.
//
// This is where a firm's super-admin adjusts how the platform behaves for
// their firm — settings, feature toggles, staff & roles.
//
// Hierarchy: Law Firm Owner ⊃ Super Admin ⊃ Attorney. The Law Firm Owner sees
// everything in this portal PLUS owner-only sections (accounting reporting,
// productivity reporting, feature-grant controls) — see LawFirmOwnerPortal.tsx.
//
// Distinct from `admin/SuperAdminPage` ("bankruptcy.ai Admin"), which is the
// BUSINESS / platform-operator side. The two MUST stay separate:
//   - This page: a firm super-admin managing their OWN firm's platform settings
//   - bankruptcy.ai Admin: the platform team managing tenants / billing / etc.
//
// SCAFFOLD ONLY. The Productivity subsection embeds the existing
// SuperAdminPortal component — that view was previously a top-level nav tab
// and is now hosted here. The Productivity top-level nav entry was hidden in
// the same patch.
//
// Subsections:
//   1. Firm settings        — placeholder; future surface for firm-wide config
//   2. Feature toggles      — per-firm enable/disable; Productivity hosted here
//   3. Staff & roles        — placeholder
//
// Role gate is handled by the App.tsx nav (only renders for the firm's
// super-admin role). The page also renders an in-page "not authorized" view
// if loaded directly without the role, mirroring bankruptcy.ai Admin's
// defense-in-depth pattern.

import { useState } from "react";
import {
  Shield, Building2, ToggleLeft, Users, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import SuperAdminPortal from "./SuperAdminPortal";

interface SuperAdminConsoleProps {
  /** True when the current viewer is the firm's super admin. */
  isFirmSuperAdmin: boolean;
}

export default function SuperAdminConsole({ isFirmSuperAdmin }: SuperAdminConsoleProps) {
  // Productivity is collapsed by default so the page loads fast; the embedded
  // SuperAdminPortal does its own fetching when expanded.
  const [productivityOpen, setProductivityOpen] = useState(false);

  if (!isFirmSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-100 p-8" style={{ background: "#0F0F0E" }}>
        <div className="max-w-md text-center">
          <Shield className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-[#FAFAF7] mb-2">Super Admin Setting Portal</h1>
          <p className="text-sm text-[#6B6B66] leading-relaxed">
            This portal is restricted to the firm's super-admin role (or the Law Firm Owner).
            If you should have access, ask your firm's owner to grant the role to your user profile.
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
        <Shield className="w-4 h-4 text-[#B8945F] mr-2" />
        <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          Super Admin Setting Portal
        </span>
        <span className="ml-2 text-[10px] uppercase tracking-widest text-[#6B6B66]">firm-facing · scaffold</span>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8 lg:py-10 space-y-6">
        <ScaffoldBanner />

        <Subsection
          icon={<Building2 className="w-4 h-4 text-[#B8945F]" />}
          title="Firm settings"
          subtitle="Firm-wide config — display name, timezone, default consult modality, business hours, branding."
        >
          <ComingSoon note="Reads / writes against firms + firm_branding + firm_communications_config. Surface lands in the follow-up build." />
        </Subsection>

        <Subsection
          icon={<ToggleLeft className="w-4 h-4 text-[#B8945F]" />}
          title="Feature toggles"
          subtitle="Per-firm enable / disable for nav-level features. Drives the top-level Intake Portal nav visibility."
        >
          <ComingSoon note="Future surface: a toggle list backed by firm_features. Pre-existing nav flags (feature_intake_portal, feature_signing_review, etc.) are read-only here today." />

          {/* Productivity hosted as a nested subsection — pulls the previously
              top-level Productivity view down into this console. */}
          <div className="mt-4 rounded-lg border border-[#2A2A28] bg-[#0F0F0E]">
            <button
              type="button"
              onClick={() => setProductivityOpen(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#1A1A18] transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#B8945F]">
                Hosted feature
              </span>
              <span className="text-xs font-semibold text-[#FAFAF7]">Productivity</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-[#6B6B66]">
                {productivityOpen ? "Hide" : "Open"}
                {productivityOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>
            {productivityOpen && (
              <div className="border-t border-[#2A2A28]">
                {/* Embedded view — the same component that powered the old
                    top-level Productivity tab. Its inner header / styling
                    differs from this console's; that's expected for the
                    scaffold (visual unification follows in the feature build). */}
                <SuperAdminPortal />
              </div>
            )}
            {!productivityOpen && (
              <p className="px-3 pb-3 text-[10px] text-[#6B6B66] italic">
                Previously a top-level Productivity tab; now hosted inside this console.
                Open to view the existing dashboard.
              </p>
            )}
          </div>
        </Subsection>

        <Subsection
          icon={<Users className="w-4 h-4 text-[#B8945F]" />}
          title="Staff & roles"
          subtitle="Add, deactivate, and assign intake-portal roles + PINs for firm staff."
        >
          <ComingSoon note="Future surface: a CRUD on staff_members with role and intake_portal_role assignment. Today this is managed manually via SQL / Supabase dashboard." />

          {/* New-employee setup — design notes only. Static text; no inputs, no form,
              no fetches. Documents the planned shape so the feature build inherits
              a frozen spec instead of redesigning from scratch. */}
          <div className="mt-4 rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-[#6B6B66] uppercase tracking-widest">
                Coming soon — reminder to design
              </p>
              <span className="text-[9px] uppercase tracking-widest text-[#B8945F] font-semibold">
                new-employee setup
              </span>
            </div>
            <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
              When the firm creates a new employee, the form will collect role, departments, tasks,
              and the employment fields below. Static reference notes only — no live inputs here.
            </p>

            <div className="space-y-3">
              {/* Role */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAF7] mb-1.5">
                  Role <span className="text-[#6B6B66] font-normal normal-case tracking-normal">(firm picks one)</span>
                </p>
                <ul className="text-[11px] text-[#6B6B66] leading-relaxed list-disc pl-4 space-y-0.5">
                  <li>Legal Administrator</li>
                  <li>Paralegal</li>
                  <li>Receptionist</li>
                  <li>Of-Counsel</li>
                  <li>Attorney</li>
                  <li>Attorney Supervisor</li>
                  <li>Accounting Supervisor</li>
                  <li>Intake Supervisor</li>
                  <li><span className="italic">+ "Create custom role name"</span> escape hatch for firm-specific titles</li>
                </ul>
              </div>

              {/* Department + tasks */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAF7] mb-1.5">
                  Department & tasks
                </p>
                <ul className="text-[11px] text-[#6B6B66] leading-relaxed list-disc pl-4 space-y-0.5">
                  <li>Assign which department(s) the employee belongs to (multi-select).</li>
                  <li>Select which tasks they handle within those departments.</li>
                </ul>
              </div>

              {/* Planned fields (left → right) */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAF7] mb-1.5">
                  Planned fields <span className="text-[#6B6B66] font-normal normal-case tracking-normal">(left → right)</span>
                </p>
                <ul className="text-[11px] text-[#6B6B66] leading-relaxed list-disc pl-4 space-y-0.5">
                  <li>Name</li>
                  <li>Email</li>
                  <li>Phone Number</li>
                  <li>Hours of Operation</li>
                  <li>PTO <span className="italic">(when available; renews yearly or carries over)</span></li>
                  <li>Sick time off</li>
                  <li>FMLA</li>
                  <li>Full-time / part-time</li>
                  <li>Compensation <span className="italic">(hourly / salary / bonus)</span></li>
                  <li>Other benefits <span className="italic">(Health Insurance, Dental, etc.)</span></li>
                </ul>
              </div>
            </div>

            <p className="mt-3 text-[10px] text-[#6B6B66] italic">
              Reference only — the form, validation, and persistence land in the follow-up build.
            </p>
          </div>
        </Subsection>
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
          <p className="text-xs font-semibold text-amber-300">Scaffold page</p>
          <p className="text-[11px] text-amber-200/80 mt-0.5">
            Where adjustments to the platform are made for this firm. Nav + role gate + subsections are in place;
            firm-settings + feature-toggles + staff-CRUD internals ship in the follow-up build. Productivity is already
            hosted here — it was the previous top-level Productivity tab. The Law Firm Owner sees additional sections
            (accounting + productivity reporting, feature-grant controls) in the Law Firm Owner Portal (#20).
          </p>
        </div>
      </div>
    </div>
  );
}

function Subsection({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0F0F0E] border border-[#2A2A28] flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#FAFAF7]">{title}</h3>
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
