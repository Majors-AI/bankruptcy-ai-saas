import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ClipboardCheck,
  PenLine,
  FolderArchive,
  Calendar,
  DollarSign,
  ListChecks,
  LogOut,
} from "lucide-react";
import ParalegalReview from "./ParalegalReview";
import SigningReview from "./components/SigningReview";
import DepartmentPortalLogin, {
  classifyLegalStaff,
  type DepartmentPortalSession,
} from "./components/department-portal/DepartmentPortalLogin";
// Slice L-2 (Prompt 62) — Legal Department Dashboard. Mounts the shared
// department-dashboard shell on the "tasks" section; replaces the
// earlier DepartmentTaskBoard stub. LEGAL_TASK_STUBS + the stub board
// live in src/components/department-portal/DepartmentTaskBoard.tsx and
// are no longer imported here (L-3 supplies a real task pool).
import LegalDashboard from "./components/legal/LegalDashboard";
import type {
  AttorneyIntakeReviewRow,
  SigningReviewRow,
  ParalegalReviewRow,
  EcfTaskRow,
  IntakeLeadRow,
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

interface SectionDef {
  id: Section;
  label: string;
  icon: ReactNode;
  status: "active" | "placeholder";
}

const SECTIONS: SectionDef[] = [
  { id: "tasks",            label: "Tasks",            icon: <ListChecks className="w-4 h-4" />,     status: "active" },
  { id: "paralegal_review", label: "Paralegal Review", icon: <ClipboardCheck className="w-4 h-4" />, status: "active" },
  { id: "signing_review",   label: "Signing Review",   icon: <PenLine className="w-4 h-4" />,        status: "active" },
  { id: "file_cabinet",     label: "File Cabinet",     icon: <FolderArchive className="w-4 h-4" />,  status: "placeholder" },
  { id: "calendar",         label: "Calendar",         icon: <Calendar className="w-4 h-4" />,       status: "placeholder" },
  { id: "time_fees",        label: "Time & Fees",      icon: <DollarSign className="w-4 h-4" />,     status: "placeholder" },
];

export default function LegalDepartmentPortal() {
  const [session, setSession] = useState<DepartmentPortalSession | null>(null);
  const [section, setSection] = useState<Section>("tasks");

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

  const load = useCallback(async () => {
    const [air, sr, pr, et, il] = await Promise.all([
      // decision='pending' covers both the stale (RED) and fresh (YELLOW)
      // tiers; buildLegalTasks splits by age.
      api.get<AttorneyIntakeReviewRow>(
        "attorney_intake_reviews?decision=eq.pending&order=created_at.desc&limit=200",
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
      api.get<IntakeLeadRow>(
        "intake_leads?select=id,full_name&order=created_at.desc&limit=500",
      ),
    ]);
    setAttorneyIntakeReviews(air);
    setSigningReviews(sr);
    setParalegalReviews(pr);
    setEcfTasks(et);
    setIntakeLeads(il);
  }, []);

  useEffect(() => { load(); }, [load]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Portal header + sub-nav */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>
              Legal Department Portal
            </h1>
            <p className="text-[11px] text-slate-500">Paralegal Review · Signing Review · (more soon)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-white leading-none">{session.name}</p>
              <p className="text-[10px] text-slate-500 mt-1">{session.user_type}</p>
            </div>
            <button
              onClick={() => setSession(null)}
              title="Sign out"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded transition-colors"
            >
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {SECTIONS.map(s => {
            const isActive = section === s.id;
            const isPlaceholder = s.status === "placeholder";
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  isActive
                    ? "border-indigo-400 text-indigo-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                } ${isPlaceholder ? "italic opacity-60" : ""}`}
              >
                {s.icon}
                {s.label}
                {isPlaceholder && (
                  <span className="text-[9px] uppercase tracking-widest text-slate-600">Soon</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Active section content. */}
      <main className="max-w-7xl mx-auto">
        {section === "tasks" && (
          // Slice L-2 (Prompt 62) — Legal Department Dashboard mounted
          // from the shared department-dashboard shell.
          // Slice L-3 (Prompt 63) — LEFT widget wired against the
          // mount-level Promise.all above; no re-fetch in the dashboard.
          <LegalDashboard
            session={session}
            attorneyIntakeReviews={attorneyIntakeReviews}
            signingReviews={signingReviews}
            paralegalReviews={paralegalReviews}
            ecfTasks={ecfTasks}
            intakeLeads={intakeLeads}
          />
        )}
        {section === "paralegal_review" && <ParalegalReview layout="embedded" />}
        {section === "signing_review"   && <SigningReview   layout="embedded" />}
        {section === "file_cabinet" && (
          <Placeholder
            label="File Cabinet"
            hint="Phase 2 step 2 — wire the existing FileCabinet component into this slot."
          />
        )}
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
      </main>
    </div>
  );
}

function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="p-12">
      <div className="max-w-xl">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">{label}</p>
        <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>
          Not wired yet
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}
