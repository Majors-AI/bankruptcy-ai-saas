// Law Firm Settings (renamed from "Super Admin Setting Portal").
//
// Persistent left-nav layout (top → bottom):
//   Firm Directory → White Label → Bankruptcy Exemptions → Median Income
//   → Living Standards → Departments (Intake / Accounting / Legal).
//
// Hierarchy: Law Firm Owner ⊃ Super Admin ⊃ Attorney. The Owner sees this
// portal PLUS the owner-only sections in LawFirmOwnerPortal (#20).
//
// Distinct from `admin/SuperAdminPage` ("bankruptcy.ai Admin"), which is the
// BUSINESS / platform-operator console.

import { useState } from "react";
import {
  Shield, Users, Image, Scale, DollarSign, Home, Network,
  ChevronRight, ChevronDown, BookOpen, Gauge, Calculator,
  Car,
} from "lucide-react";
import {
  DepartmentManagementProvider,
} from "./components/department-management/store";
import { WhiteLabelProvider, useWhiteLabel, schemeCss } from "./components/law-firm-settings/whiteLabelStore";
import { RulesAuditProvider } from "./components/law-firm-settings/rulesAuditStore";
import { CaseTypeProvider } from "./components/law-firm-settings/CaseTypeAssignment";
import { ReassignmentProvider } from "./components/law-firm-settings/ReassignmentRequests";
import { LegalFilingsProvider } from "./components/law-firm-settings/LegalPrePostPanel";
import { IntakePipelineProvider } from "./components/law-firm-settings/IntakeRetentionPipeline";

import FirmDirectory from "./components/law-firm-settings/FirmDirectory";
import WhiteLabelSection from "./components/law-firm-settings/WhiteLabelSection";
import BankruptcyExemptionsPage from "./components/law-firm-settings/BankruptcyExemptionsPage";
import MedianIncomePage from "./components/law-firm-settings/MedianIncomePage";
import MeansTestExpensesPage from "./components/law-firm-settings/MeansTestExpensesPage";
import LivingStandardsPage from "./components/law-firm-settings/LivingStandardsPage";
import DepartmentsPage from "./components/law-firm-settings/DepartmentsPage";
import ClientPublicRelationsPlaceholder from "./components/law-firm-settings/ClientPublicRelationsPlaceholder";
import LocalRulesPage from "./components/law-firm-settings/LocalRulesPage";
import FirmPolicyPage from "./components/law-firm-settings/FirmPolicyPage";

import type { ViewerRole, DepartmentId } from "./components/department-management/types";

interface Props {
  /** True when the viewer is the firm's super admin role (or higher). */
  isFirmSuperAdmin: boolean;
  /** True when the viewer is the law-firm-owner role specifically — unlocks
   *  owner-only controls inside the Departments / approval-gate surfaces. */
  isLawFirmOwner?: boolean;
}

// Top-level views. Two NAV GROUPS (Means Test, Living Standards) host
// expandable sub-items beneath them — matching the Departments pattern.
type MeansTestSubKey = "median" | "means_test_expenses";
type LivingSubKey = "ls_national" | "ls_housing" | "ls_transportation";
type NavKey =
  | "directory" | "white_label" | "exemptions"
  | "means_test" | MeansTestSubKey
  | "living" | LivingSubKey
  | "local_rules" | "firm_policy"
  | "departments";

// Leaf items rendered as flat rows in the top nav (above the expandable
// groups). Order: identity → branding → exemptions; then the Means Test +
// Living Standards groups; then the remaining leaves below them.
const TOP_NAV_LEAVES: Array<{ key: "directory" | "white_label" | "exemptions"; label: string; icon: React.FC<{ className?: string }> }> = [
  { key: "directory",   label: "Firm Directory",        icon: Users },
  { key: "white_label", label: "White Label",           icon: Image },
  { key: "exemptions",  label: "Bankruptcy Exemptions", icon: Scale },
];

const BELOW_GROUP_NAV: Array<{ key: "local_rules" | "firm_policy"; label: string; icon: React.FC<{ className?: string }> }> = [
  { key: "local_rules", label: "Local Rules",           icon: BookOpen },
  // Firm Policy — firm-set knobs (NOT canonical, NOT statutory). Today
  // hosts the DMI triage threshold; more firm-local knobs land here.
  { key: "firm_policy", label: "Firm Policy",           icon: Gauge },
];

// Means Test group — sits above Median Income per the firm's mental model
// ("Means Test → median + expenses → over/under threshold"). Median
// Income is the threshold input; Means Test Expenses is the
// IRS-allowable expense catalog used on the long-form (122A-2 / 122C-2).
const MEANS_TEST_NAV: Array<{ key: MeansTestSubKey; label: string; icon: React.FC<{ className?: string }> }> = [
  { key: "median",               label: "Median Income",          icon: DollarSign },
  { key: "means_test_expenses",  label: "Means Test Expenses",    icon: Calculator },
];

// Living Standards group — each sub-section is a separate nav child so
// the firm can deep-link to a single category. Mirrors the Departments
// expandable-group pattern.
const LIVING_NAV: Array<{ key: LivingSubKey; label: string; icon: React.FC<{ className?: string }>; activeSub: "national" | "housing" | "transportation" }> = [
  { key: "ls_national",       label: "National Standards",       icon: Home, activeSub: "national" },
  { key: "ls_housing",        label: "Local Housing & Utilities", icon: Home, activeSub: "housing" },
  { key: "ls_transportation", label: "Transportation",           icon: Car,  activeSub: "transportation" },
];

// Departments group — children route to their own dedicated pages. Order
// matches the firm's workflow (lead in → case out), with Client Public
// Relations (mass mail-merge hub — scaffold only) slotted between
// Accounting and Legal.
const DEPT_NAV: Array<{ key: DepartmentId; label: string }> = [
  { key: "intake",     label: "Intake" },
  { key: "accounting", label: "Accounting" },
  { key: "client_pr",  label: "Client Public Relations" },
  { key: "legal",      label: "Legal" },
];

export default function LawFirmSettings({ isFirmSuperAdmin, isLawFirmOwner = false }: Props) {
  if (!isFirmSuperAdmin && !isLawFirmOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-100 p-8" style={{ background: "#0F0F0E" }}>
        <div className="max-w-md text-center">
          <Shield className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-[#FAFAF7] mb-2">Law Firm Settings</h1>
          <p className="text-sm text-[#6B6B66] leading-relaxed">
            This portal is restricted to the firm's super-admin role (or the Law Firm Owner).
          </p>
        </div>
      </div>
    );
  }

  const viewerRole: ViewerRole = isLawFirmOwner ? "law_firm_owner" : "super_admin";
  // LegalReferenceViewerRole for the living-standards overlay gate. Maps
  // the existing isLawFirmOwner flag to the canonical enum value
  // `law_firm_owner`; non-owner viewers see `super_admin` (firm-tier admin,
  // NOT a lawyer per the role spec) which fails the attorney-supervisor /
  // owner gate inside canAdjustLivingStandards.
  // TODO Phase B: thread `attorney_super_admin` through when the
  // portal-role plumbing into LawFirmSettings adds it.
  const legalReferenceRole: import("./components/legal-reference/LegalReferenceStore").LegalReferenceViewerRole =
    isLawFirmOwner ? "law_firm_owner" : "super_admin";

  return (
    <WhiteLabelProvider>
      <DepartmentManagementProvider actor={{ id: "actor-stub", name: isLawFirmOwner ? "Law Firm Owner" : "Super Admin", role: viewerRole }}>
        <RulesAuditProvider>
          <CaseTypeProvider>
            <ReassignmentProvider>
              <LegalFilingsProvider>
                <IntakePipelineProvider>
                  <Shell
                    viewerRole={viewerRole}
                    legalReferenceRole={legalReferenceRole}
                  />
                </IntakePipelineProvider>
              </LegalFilingsProvider>
            </ReassignmentProvider>
          </CaseTypeProvider>
        </RulesAuditProvider>
      </DepartmentManagementProvider>
    </WhiteLabelProvider>
  );
}

function Shell({
  viewerRole, legalReferenceRole,
}: {
  viewerRole: ViewerRole;
  legalReferenceRole: import("./components/legal-reference/LegalReferenceStore").LegalReferenceViewerRole;
}) {
  const wl = useWhiteLabel();
  // View state — `view` picks the section. When view === "departments", the
  // active department lives in `activeDept`. Defaulting to Intake matches
  // the firm's workflow (lead in → case out).
  const [view, setView] = useState<NavKey>("directory");
  const [activeDept, setActiveDept] = useState<DepartmentId>("intake");
  const [deptGroupOpen, setDeptGroupOpen] = useState(true);
  const [meansGroupOpen, setMeansGroupOpen] = useState(true);
  const [livingGroupOpen, setLivingGroupOpen] = useState(true);
  const [viewerDepartmentId] = useState<DepartmentId | null>(null);

  function openDept(id: DepartmentId) {
    setView("departments");
    setActiveDept(id);
    setDeptGroupOpen(true);
  }

  // Resolve the Living Standards sub-block for the currently selected
  // nav child. Defaults to "all" when nothing is selected, preserving the
  // historical "show every sub-section" rendering for any consumer that
  // still routes via the bare `living` key.
  const livingActiveSub: "all" | "national" | "housing" | "transportation" =
    view === "ls_national"       ? "national"
    : view === "ls_housing"      ? "housing"
    : view === "ls_transportation" ? "transportation"
    : "all";

  // Apply the GLOBAL scheme at the shell level. Department pages re-scope to
  // the per-department scheme within their own wrappers.
  return (
    <div className="min-h-screen text-slate-100" style={{ ...schemeCss(wl.globalScheme), background: "#0F0F0E" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 px-6 flex items-center"
        style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28" }}
      >
        {wl.logoUrl ? (
          <img src={wl.logoUrl} alt="Firm logo" className="h-7 max-w-[140px] object-contain mr-3" />
        ) : (
          <Shield className="w-4 h-4 mr-2" style={{ color: "var(--lfs-accent)" }} />
        )}
        <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          Law Firm Settings
        </span>
        <span className="ml-2 text-[10px] uppercase tracking-widest text-[#6B6B66]">
          {wl.firmName}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-[#6B6B66]">
          {viewerRole.replace(/_/g, " ")}
        </span>
      </header>

      <div className="flex flex-col lg:flex-row lg:items-start">
        {/* Persistent left nav */}
        <nav
          className="lg:sticky lg:top-[56px] lg:w-60 lg:flex-shrink-0 lg:h-[calc(100vh-56px)] lg:overflow-y-auto p-3 border-b lg:border-b-0 lg:border-r"
          style={{ background: "#0F0F0E", borderColor: "#2A2A28" }}
        >
          <ul className="space-y-0.5">
            {/* Top leaves — Firm Directory · White Label · Bankruptcy Exemptions */}
            {TOP_NAV_LEAVES.map(item => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <li key={item.key}>
                  <NavLeaf
                    label={item.label}
                    icon={<Icon className="w-3.5 h-3.5" />}
                    active={active}
                    onClick={() => setView(item.key)}
                  />
                </li>
              );
            })}

            {/* Means Test — expandable group: Median Income + Means Test Expenses */}
            <NavGroup
              label="Means Test"
              icon={<Calculator className="w-3.5 h-3.5" />}
              open={meansGroupOpen}
              onToggle={() => setMeansGroupOpen(o => !o)}
              active={view === "median" || view === "means_test_expenses"}
            >
              {MEANS_TEST_NAV.map(child => {
                const ChildIcon = child.icon;
                const isActive = view === child.key;
                return (
                  <NavChild
                    key={child.key}
                    label={child.label}
                    icon={<ChildIcon className="w-3 h-3" />}
                    active={isActive}
                    onClick={() => setView(child.key)}
                  />
                );
              })}
            </NavGroup>

            {/* Living Standards — expandable group: National · Housing & Utilities · Transportation */}
            <NavGroup
              label="Living Standards"
              icon={<Home className="w-3.5 h-3.5" />}
              open={livingGroupOpen}
              onToggle={() => setLivingGroupOpen(o => !o)}
              active={view === "living" || view === "ls_national" || view === "ls_housing" || view === "ls_transportation"}
            >
              {LIVING_NAV.map(child => {
                const ChildIcon = child.icon;
                const isActive = view === child.key;
                return (
                  <NavChild
                    key={child.key}
                    label={child.label}
                    icon={<ChildIcon className="w-3 h-3" />}
                    active={isActive}
                    onClick={() => setView(child.key)}
                  />
                );
              })}
            </NavGroup>

            {/* Local Rules + Firm Policy — leaves below the means/living groups */}
            {BELOW_GROUP_NAV.map(item => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <li key={item.key}>
                  <NavLeaf
                    label={item.label}
                    icon={<Icon className="w-3.5 h-3.5" />}
                    active={active}
                    onClick={() => setView(item.key)}
                  />
                </li>
              );
            })}

            {/* Departments — expandable group with three children. */}
            <li>
              <button
                type="button"
                onClick={() => setDeptGroupOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded text-[12px] font-semibold transition-colors"
                style={view === "departments"
                  ? { background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)", color: "#FAFAF7", borderLeft: "3px solid var(--lfs-accent)", paddingLeft: 9 }
                  : { color: "#6B6B66" }}
                onMouseEnter={e => { if (view !== "departments") (e.currentTarget as HTMLButtonElement).style.color = "#FAFAF7"; }}
                onMouseLeave={e => { if (view !== "departments") (e.currentTarget as HTMLButtonElement).style.color = "#6B6B66"; }}
                aria-expanded={deptGroupOpen}
              >
                <span className="inline-flex items-center gap-2">
                  <Network className="w-3.5 h-3.5" />
                  Departments
                </span>
                {deptGroupOpen
                  ? <ChevronDown className="w-3 h-3 opacity-60" />
                  : <ChevronRight className="w-3 h-3 opacity-60" />}
              </button>
              {deptGroupOpen && (
                <ul className="mt-0.5 ml-3 pl-2 border-l space-y-0.5" style={{ borderColor: "#2A2A28" }}>
                  {DEPT_NAV.map(child => {
                    const isActive = view === "departments" && activeDept === child.key;
                    return (
                      <li key={child.key}>
                        <button
                          type="button"
                          onClick={() => openDept(child.key)}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors"
                          style={isActive
                            ? { background: "color-mix(in srgb, var(--lfs-accent) 18%, transparent)", color: "#FAFAF7" }
                            : { color: "#6B6B66" }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#FAFAF7"; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#6B6B66"; }}
                        >
                          <span>{child.label}</span>
                          <ChevronRight className="w-3 h-3 opacity-60" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          </ul>
          <p className="text-[10px] text-[#6B6B66] italic mt-4 leading-snug">
            Consistent palette across every section. Per-department scheme overrides apply
            only within that department's views.
          </p>
        </nav>

        {/* Page area */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 space-y-6 max-w-6xl">
          {view === "directory"   && <FirmDirectory viewerRole={viewerRole} />}
          {view === "white_label" && <WhiteLabelSection />}
          {/* Canonical datasets are READ-ONLY at the firm level for every
              viewer. Edits live in the Bankruptcy.AI admin portal's
              Reference Rules control tower (src/admin/ReferenceRulesTab).
              The firm-side LivingStandardsPage keeps the attorney
              supervisor/owner overlay (a firm customization, not a canonical
              edit). */}
          {view === "exemptions"  && <BankruptcyExemptionsPage viewerRole={viewerRole} />}
          {/* Means Test group — Median Income + Means Test Expenses */}
          {view === "median"               && <MedianIncomePage         viewerRole={viewerRole} />}
          {view === "means_test_expenses"  && <MeansTestExpensesPage />}
          {/* Living Standards group — all + per-sub focused views */}
          {(view === "living" || view === "ls_national" || view === "ls_housing" || view === "ls_transportation") && (
            <LivingStandardsPage
              viewerRole={viewerRole}
              legalReferenceRole={legalReferenceRole}
              activeSub={livingActiveSub}
            />
          )}
          {view === "local_rules" && <LocalRulesPage />}
          {view === "firm_policy" && <FirmPolicyPage legalReferenceRole={legalReferenceRole} />}
          {view === "departments" && (
            // Client Public Relations is scaffold-only — its placeholder
            // page replaces the standard DepartmentsPage for this key until
            // the feature is built out.
            activeDept === "client_pr" ? (
              <ClientPublicRelationsPlaceholder />
            ) : (
              <DepartmentsPage
                departmentId={activeDept}
                viewerRole={viewerRole}
                viewerDepartmentId={viewerDepartmentId}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}

// Expandable nav group (Means Test, Living Standards) — mirrors the
// Departments group's rendering. The parent button toggles open/closed;
// `active` (any child or the group itself selected) lights the parent.
function NavGroup({
  label, icon, open, onToggle, active, children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded text-[12px] font-semibold transition-colors"
        style={active
          ? { background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)", color: "#FAFAF7", borderLeft: "3px solid var(--lfs-accent)", paddingLeft: 9 }
          : { color: "#6B6B66" }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#FAFAF7"; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#6B6B66"; }}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">{icon}{label}</span>
        {open ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />}
      </button>
      {open && (
        <ul className="mt-0.5 ml-3 pl-2 border-l space-y-0.5" style={{ borderColor: "#2A2A28" }}>
          {children}
        </ul>
      )}
    </li>
  );
}

// One child row inside a NavGroup.
function NavChild({
  label, icon, active, onClick,
}: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors"
        style={active
          ? { background: "color-mix(in srgb, var(--lfs-accent) 18%, transparent)", color: "#FAFAF7" }
          : { color: "#6B6B66" }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#FAFAF7"; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#6B6B66"; }}
      >
        <span className="inline-flex items-center gap-2">{icon}{label}</span>
        <ChevronRight className="w-3 h-3 opacity-60" />
      </button>
    </li>
  );
}

// Single leaf nav item — extracted so the rendering matches between the
// top-level items and any future nested groups.
function NavLeaf({
  label, icon, active, onClick,
}: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded text-[12px] font-semibold transition-colors"
      style={active
        ? { background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)", color: "#FAFAF7", borderLeft: "3px solid var(--lfs-accent)", paddingLeft: 9 }
        : { color: "#6B6B66" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#FAFAF7"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#6B6B66"; }}
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ChevronRight className="w-3 h-3 opacity-60" />
    </button>
  );
}
