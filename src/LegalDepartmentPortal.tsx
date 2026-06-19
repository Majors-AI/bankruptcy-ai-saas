import { useCallback, useEffect, useMemo, useState } from "react";
import ParalegalReview from "./ParalegalReview";
import SigningReview from "./components/SigningReview";
import FileCabinet from "./FileCabinet";
import DepartmentPortalLogin, {
  classifyLegalStaff,
  type DepartmentPortalSession,
} from "./components/department-portal/DepartmentPortalLogin";
// Sub-phase 1 of the legal portal restyle — see
// docs/design/legal-portal-function-mapping.md §11. Wraps the existing
// section router in the new LegalPortalShell (light theme · 3 role-tab
// pill · left utility rail · R2 Pipeline) without altering routing
// behavior. Old dark-theme header + horizontal sub-nav replaced.
import LegalPortalShell from "./legal-portal/LegalPortalShell";
import {
  c,
  type LegalRole,
  type StageKey,
} from "./legal-portal/legalPortalTokens";
import {
  DEFAULT_RAIL_ENTRIES,
  type RailEntry,
  type RailGateContext,
} from "./legal-portal/railEntries";
import { useCurrentRole } from "./lib/AuthProvider";
// Slice L-2 (Prompt 62) — Legal Department Dashboard. Mounts the shared
// department-dashboard shell on the "tasks" section; replaces the
// earlier DepartmentTaskBoard stub. LEGAL_TASK_STUBS + the stub board
// live in src/components/department-portal/DepartmentTaskBoard.tsx and
// are no longer imported here (L-3 supplies a real task pool).
import LegalDashboard from "./components/legal/LegalDashboard";
// RulesAuditProvider — required by SigningReview's LongFormDeductionPanel
// + Ch13Eligibility (both call useRulesAudit). Pre-restyle, this portal
// did NOT mount the provider either, but the bug was latent: it only
// fires when isLawyer=true, and the surface was hard to reach for
// lawyers without an explicit rail entry. Sub-phase 1's interim
// signing_review rail icon (added 11.1 of the mapping doc) makes the
// surface clickable for lawyers, exposing the latent error. Mounting the
// provider here matches the LawFirmSettings.tsx + admin/ReferenceRulesTab
// pattern (wrap at portal-mount level).
//
// SCOPE NOTE — this same latent bug exists at:
//   - App.tsx view === 'signing_review'      (line 690)
//   - App.tsx view === 'signing_review_ch13' (line 700)
//   - LegalAdminPortal's SigningReview entry points
// Fixing those is OUT OF SUB-PHASE-1 SCOPE — they need their own diff
// with regression verification. Calling it out so it doesn't get lost.
import { RulesAuditProvider } from "./components/law-firm-settings/rulesAuditStore";
import type {
  AttorneyIntakeReviewRow,
  SigningReviewRow,
  ParalegalReviewRow,
  EcfTaskRow,
  IntakeLeadRow,
  CalendarEventRow,
  AcceptanceRow,
  EcfInboxRow,
  FiledCaseRegistryRow,
} from "./components/legal/legalTasks";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const V1_FIRM_ID    = (import.meta.env.VITE_FIRM_ID as string | undefined)
  ?? "00000000-0000-0000-0000-000000000001";

// Slice L-3 (Prompt 63) — minimal REST helper for the mount-level Promise.all.
// Mirrors AccountingPortal's api.get; the dashboard is read-only here.
const api = {
  get: async <T,>(path: string): Promise<T[]> => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    return r.ok ? (r.json() as Promise<T[]>) : ([] as T[]);
  },
};

// Phase 2 step 1: shell with sub-nav. Mounts the existing ParalegalReview
// and SigningReview components in 'embedded' layout (no double chrome).
// Tabs 15/16/17 remain at the top level of the global nav until the mounted
// versions here are confirmed working — Phase 2 step 2 removes them.
//
// Entry gate: staff-pick + 4-digit PIN, mirroring the Intake Portal's
// PortalLogin pattern. Shared dev PIN — see DepartmentPortalLogin.tsx.

type Section =
  | "tasks"
  | "paralegal_review"
  | "signing_review"
  | "file_cabinet"
  | "calendar"
  | "time_fees";

// Map current section → rail-entry key for the active-icon highlight.
//
// paralegal_review + signing_review highlight against their INTERIM rail
// entries (defined in src/legal-portal/UtilityRail.tsx). When sub-phase 2
// lands and the Queue's case-row click becomes the canonical entry into
// those workspaces, the interim rail entries are removed and these two
// keys flip back to `null`.
const SECTION_TO_RAIL_KEY: Readonly<Record<Section, string | null>> = {
  tasks:            "tasks",
  paralegal_review: "paralegal_review_interim", // ⚠ INTERIM — sub-phase 2 removes
  signing_review:   "signing_review_interim",   // ⚠ INTERIM — sub-phase 2 removes
  file_cabinet:     "documents",
  calendar:         "calendar",
  time_fees:        "time_fees",
};

export interface LegalDepartmentPortalProps {
  /** Cross-portal navigation callback. The new utility rail uses this
   *  for entries whose destination lives in the `legal_admin` view
   *  (Leads / Messages / Settings / Out-of-Office / Manual Clients).
   *  Sub-phase 6 will fold these into proper rail panels; sub-phase 1
   *  routes them to the existing tabs so nothing is unreachable. */
  onNavigateToAdmin?: () => void;
}

export default function LegalDepartmentPortal({ onNavigateToAdmin }: LegalDepartmentPortalProps = {}) {
  const [session, setSession] = useState<DepartmentPortalSession | null>(null);
  const [section, setSection] = useState<Section>("tasks");
  // Role-tab selection — defaults to the closest match for the PIN-gate
  // session user type. The body content router is still section-driven
  // in sub-phase 1; sub-phase 3+ uses role to switch between Paralegal /
  // Attorney case workspaces.
  const [role, setRole] = useState<LegalRole>("paralegal");
  // Sub-phase 1: no Queue selection yet → Pipeline always hidden.
  // Sub-phase 2 wires the selected case's signals through
  // `derivePipelineStage()` and threads the resulting StageKey here.
  const [activeStage] = useState<StageKey | null>(null);

  // AuthProvider firm-tier role — secondary source for rail gates. The
  // PIN-gate session.user_type is the primary source; this fills in
  // permissions the PIN gate cannot resolve (legal_admin, super_admin).
  const sessionRole = useCurrentRole();

  // Slice L-3 (Prompt 63) — task-pool sources. Loaded ONCE at mount; the
  // LegalDashboard receives them as props and derives the color-tiered
  // TaskEntry[] via buildLegalTasks. No re-fetch on section switch.
  //
  // Firm scoping:
  //   - signing_reviews has firm_id → filtered server-side.
  //   - attorney_intake_reviews / paralegal_reviews / ecf_tasks have no
  //     firm_id column today; relies on table-level RLS for isolation
  //     (firm-scoped enforcement is part of Canelo's BAN-77/78 thread).
  //   - intake_leads carries firm_id, but the existing pilot dataset
  //     uses the default firm so we leave it unfiltered for L-3.
  const [attorneyIntakeReviews, setAttorneyIntakeReviews] = useState<AttorneyIntakeReviewRow[]>([]);
  const [signingReviews,        setSigningReviews]        = useState<SigningReviewRow[]>([]);
  const [paralegalReviews,      setParalegalReviews]      = useState<ParalegalReviewRow[]>([]);
  const [ecfTasks,              setEcfTasks]              = useState<EcfTaskRow[]>([]);
  const [intakeLeads,           setIntakeLeads]           = useState<IntakeLeadRow[]>([]);
  // Slice L-7 (Prompt 65) — today's hearings/filings footer source.
  // department=eq.legal at the query layer; firm-scoping is implicit via
  // staff_id → staff_members + table-level RLS (calendar_events has no
  // firm_id column today). Loaded broadly (limit 300, ordered by
  // start_time asc) and filtered client-side to today in firm TZ —
  // matches the Intake portal's pattern at LegalAdminPortal.tsx:8811.
  const [calendarEvents,        setCalendarEvents]        = useState<CalendarEventRow[]>([]);
  // Slice L-5 (Prompt 66) — Active Caseload bubble source. Provides the
  // source-of-truth chapter for accepted cases (Ch.7 vs Ch.13) and the
  // lead_id join key. Filed-vs-retained breakdown is partial: retained
  // marker is on intake_leads.status='retained' (widened select below);
  // Filed lives in accounting_filed_case_registry (cross-portal — defer);
  // Pending Discharge has no column (defer).
  const [acceptances,           setAcceptances]           = useState<AcceptanceRow[]>([]);
  // Slice L-6 (Prompt 67) — RIGHT-column legal comms source. PACER/docket
  // notices from ecf_inbox. The dashboard merges these with the already-
  // loaded attorney_intake_reviews into a StaffMessage[] list for the
  // ConsolidatedMessagingWidget. One new read; ecf_tasks (already loaded)
  // is the downstream auto-task row, not the inbound notice itself.
  const [ecfInbox,              setEcfInbox]              = useState<EcfInboxRow[]>([]);
  // Slice L-8 (Prompt 73) — Active Caseload "Filed" cell. Cross-portal
  // read of accounting_filed_case_registry — the same table the Accounting
  // filed-cases tab reads. Registry has no firm_id (FK to
  // accounting_clients scopes it); chapter is CHECK 7|13 so the bubble
  // can show a per-chapter split with no "unknown" bucket. Pending
  // Discharge still has no schema column (Gap #7) and remains "—".
  const [filedRegistry,         setFiledRegistry]         = useState<FiledCaseRegistryRow[]>([]);

  const load = useCallback(async () => {
    const [air, sr, pr, et, il, ce, ac, ei, fr] = await Promise.all([
      // Loaded broadly (no decision filter) so the L-10 RED re-review tier
      // can evaluate already-DECIDED reviews against the current ruleset
      // version. buildLegalTasks's inner `if (r.decision !== "pending")
      // continue;` guard keeps the LEFT-column RED-stale / YELLOW-pending
      // tiers scoped to pending rows; the re-review tier inspects decided
      // rows via evaluateReviewStaleness (src/lib/ruleStaleness.ts).
      //
      // No explicit select column list: reviewed_ruleset_version +
      // case_status are TODO Phase B at the DB, so naming them would 400
      // from PostgREST. The helper handles those fields as null/undefined
      // until the columns land — chip + dashboard both surface the
      // "tracking not enabled" reason in the interim (matches the chip's
      // pre-extraction behavior).
      api.get<AttorneyIntakeReviewRow>(
        "attorney_intake_reviews?order=created_at.desc&limit=200",
      ),
      // signing_reviews status enum is in_progress/completed/paused;
      // we want both unfinished states. Firm-scoped via firm_id.
      api.get<SigningReviewRow>(
        `signing_reviews?firm_id=eq.${V1_FIRM_ID}&status=in.(in_progress,paused)&order=updated_at.desc&limit=200`,
      ),
      // paralegal_reviews status enum is in_progress/complete/needs_info;
      // both unfinished states surface as YELLOW in buildLegalTasks.
      api.get<ParalegalReviewRow>(
        "paralegal_reviews?status=in.(in_progress,needs_info)&order=updated_at.desc&limit=200",
      ),
      // ecf_tasks status default is 'open' (not 'pending'). Both
      // open + in_progress surface; overdue → ORANGE, upcoming → BLUE.
      api.get<EcfTaskRow>(
        "ecf_tasks?status=in.(open,in_progress)&order=due_date.asc.nullslast&limit=200",
      ),
      // Name lookup for attorney_intake_reviews.lead_id. The other two
      // client-side tables use a `client_id text` that isn't necessarily
      // an intake_leads.id — fallback in buildLegalTasks is a truncated
      // id with a future-slice TODO for a clients lookup.
      //
      // Slice L-5 (Prompt 66) widens the select to include status,
      // chapter_interest, retained_at for the Active Caseload bubble
      // (retained-by-chapter count). Same single read.
      api.get<IntakeLeadRow>(
        "intake_leads?select=id,full_name,status,chapter_interest,retained_at&order=created_at.desc&limit=500",
      ),
      // Slice L-7 (Prompt 65) — today's hearings/filings footer.
      // Loaded broadly here; LegalDashboard filters client-side to
      // today in firm TZ.
      api.get<CalendarEventRow>(
        "calendar_events?department=eq.legal&order=start_time.asc&limit=300",
      ),
      // Slice L-5 (Prompt 66) — Active Caseload bubble: source-of-truth
      // chapter for accepted cases. Filter to decided cases so the
      // payload stays small; pending acceptances aren't relevant to
      // caseload counts.
      api.get<AcceptanceRow>(
        "attorney_case_acceptances?decision=eq.accepted&select=id,lead_id,decision,chapter,case_type,decided_at&order=decided_at.desc&limit=500",
      ),
      // Slice L-6 (Prompt 67) — RIGHT-column comms source. Include all
      // statuses so the widget can show the full triage state (pending
      // notices stay unread; task_created/responded/dismissed render
      // as read). Newest-first.
      api.get<EcfInboxRow>(
        "ecf_inbox?select=id,client_id,case_number,docket_entry,filing_type,filed_by,filed_date,deadline_days,status,created_at&order=created_at.desc&limit=200",
      ),
      // Slice L-8 (Prompt 73) — Active Caseload "Filed" cell. Mirrors the
      // Accounting filed-cases tab query (AccountingPortal.tsx:10763:
      // accounting_filed_case_registry?order=filed_date.desc); narrowed
      // here to id/chapter/filed_date since the bubble only counts.
      api.get<FiledCaseRegistryRow>(
        "accounting_filed_case_registry?select=id,chapter,filed_date&order=filed_date.desc",
      ),
    ]);
    setAttorneyIntakeReviews(air);
    setSigningReviews(sr);
    setParalegalReviews(pr);
    setEcfTasks(et);
    setIntakeLeads(il);
    setCalendarEvents(ce);
    setAcceptances(ac);
    setEcfInbox(ei);
    setFiledRegistry(fr);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Default the role tab to the closest match for the PIN-gate session
  // user_type the first time the session resolves. After that, the user
  // can switch tabs freely (it's a UI preference, not a permission).
  useEffect(() => {
    if (!session) return;
    const ut = (session.user_type || "").toLowerCase();
    if (ut.includes("attorney")) setRole("attorney");
    else setRole("paralegal");
    // Run on session change only — explicitly NOT a setRole dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Role-gate context for the utility rail. Sub-phase 1 uses simple
  // PIN-gate role mapping + AuthProvider firm-tier role; sub-phase 6
  // refines this with the canonical AuthProvider booleans App.tsx uses.
  const railCtx = useMemo<RailGateContext>(() => {
    const ut = (session?.user_type || "").toLowerCase();
    const isSupervisingAttorney = ut.includes("supervising");
    const isAnyAttorney = ut.includes("attorney");
    const isPlatformOrFirmSuper =
      sessionRole === "super_admin_bankruptcy_ai" || sessionRole === "firm_super_admin";
    const isLegalAdmin = sessionRole === "legal_admin";
    return {
      sessionUserType: session?.user_type || "",
      sessionRole: sessionRole ?? null,
      canManageLeads:    isAnyAttorney || isLegalAdmin || isPlatformOrFirmSuper,
      canManageStaff:    isSupervisingAttorney || isPlatformOrFirmSuper,
      isSuperAdmin:      isPlatformOrFirmSuper,
      canCreateClient:   isLegalAdmin || isSupervisingAttorney || isPlatformOrFirmSuper,
    };
  }, [session, sessionRole]);

  const onRailSelect = useCallback((entry: RailEntry) => {
    if (entry.dest.kind === "intra") {
      setSection(entry.dest.section as Section);
      return;
    }
    // CROSS: route to the legal_admin view (where Leads / Messages /
    // Settings / Out-of-Office / Manual Clients currently live). The
    // App.tsx parent supplies the callback.
    if (entry.dest.target === "legal_admin") {
      onNavigateToAdmin?.();
    }
  }, [onNavigateToAdmin]);

  const railActiveKey = SECTION_TO_RAIL_KEY[section];

  if (!session) {
    return (
      <DepartmentPortalLogin
        title="Legal Department Portal"
        subtitle="Paralegal · Attorney · Supervising Attorney"
        classifyStaff={classifyLegalStaff}
        onLogin={s => setSession(s)}
        accent="#818CF8"
        emptyHint="No legal-department staff configured yet. Add paralegals, attorneys, or supervising attorneys in Super Admin."
      />
    );
  }

  return (
    <LegalPortalShell
      role={role}
      onRoleChange={setRole}
      activeStage={activeStage}
      postPetition={false}
      railEntries={DEFAULT_RAIL_ENTRIES}
      railCtx={railCtx}
      railActiveKey={railActiveKey}
      onRailSelect={onRailSelect}
      session={{
        name: session.name,
        userType: session.user_type,
        onSignOut: () => setSession(null),
      }}
    >
      {/* Active section content — preserved from the pre-restyle shell.
          Sub-phase 1 swaps the outer chrome AND wraps the body in
          RulesAuditProvider (see comment above the import) so the
          SigningReview / Ch13Eligibility surfaces work for lawyers. */}
      <RulesAuditProvider>
        <div className="max-w-7xl mx-auto">
          {section === "tasks" && (
            <LegalDashboard
              session={session}
              attorneyIntakeReviews={attorneyIntakeReviews}
              signingReviews={signingReviews}
              paralegalReviews={paralegalReviews}
              ecfTasks={ecfTasks}
              intakeLeads={intakeLeads}
              calendarEvents={calendarEvents}
              acceptances={acceptances}
              ecfInbox={ecfInbox}
              filedRegistry={filedRegistry}
            />
          )}
          {section === "paralegal_review" && <ParalegalReview layout="embedded" />}
          {section === "signing_review"   && <SigningReview   layout="embedded" />}
          {section === "file_cabinet" && <FileCabinet />}
          {section === "calendar" && (
            <Placeholder
              label="Calendar"
              hint="Phase 2 step 2 — embed the firm calendar view here."
            />
          )}
          {section === "time_fees" && (
            <Placeholder
              label="Time & Fees"
              hint="Phase 2 step 2 — paralegal time entries + fee snapshot."
            />
          )}
        </div>
      </RulesAuditProvider>
    </LegalPortalShell>
  );
}

function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="p-12">
      <div
        className="max-w-xl rounded-xl p-6"
        style={{ background: c.paper, border: `1px solid ${c.line}` }}
      >
        <p
          className="text-xs font-bold uppercase mb-2"
          style={{ color: c.slateLight, letterSpacing: "0.14em" }}
        >
          {label}
        </p>
        <h2 className="text-xl font-bold mb-2" style={{ color: c.ink }}>
          Not wired yet
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: c.slate }}>
          {hint}
        </p>
      </div>
    </div>
  );
}
