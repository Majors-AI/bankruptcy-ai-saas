// Staff Training portal — page 18 in the Intake Portal nav.
//
// SCAFFOLD ONLY. Platform-onboarding training (NOT legal/CLE training):
//   - Required for every staffer
//   - Tutorial during the first 30 days for new hires
//   - Different modules per role (intake, paralegal, attorney, accounting…)
//   - Tracks completion per employee
//
// Everything below is "Coming soon" — we'll wire data, modules, completion
// tracking, and enforcement in a follow-up build. The shell is here so the
// nav slot is reserved and the subsection list is frozen.

import { GraduationCap, CalendarClock, BookOpen, UserCheck, ClipboardList, Scale, Info } from "lucide-react";

interface TrainingProps {
  /** Attorney-tier viewers see the Attorney CLE reminders subsection (CLE is attorney-specific). */
  isAttorneyRole: boolean;
}

export default function Training({ isAttorneyRole }: TrainingProps) {
  return (
    <div className="min-h-screen text-slate-100" style={{ background: "#0F0F0E" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 px-6 flex items-center"
        style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28" }}
      >
        <GraduationCap className="w-4 h-4 text-[#B8945F] mr-2" />
        <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          Staff Training
        </span>
        <span className="ml-2 text-[10px] uppercase tracking-widest text-[#6B6B66]">scaffold · coming soon</span>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8 lg:py-10 space-y-6">
        <ScaffoldBanner />

        <Subsection
          icon={<CalendarClock className="w-4 h-4 text-[#B8945F]" />}
          title="First 30 days — new-hire tutorial"
          subtitle="Mandatory onboarding flow that runs automatically for the first 30 days after a staffer's account is created."
        >
          <ComingSoon note="Day-by-day curriculum, in-app prompts, and a 30-day completion checkpoint. Surfaces as a guided overlay until the staffer finishes core modules." />
        </Subsection>

        <Subsection
          icon={<BookOpen className="w-4 h-4 text-[#B8945F]" />}
          title="Required platform training"
          subtitle="Universal modules every staffer must complete — how the portal works, keyboard shortcuts, daily flow, where things live."
        >
          <ComingSoon note="Required-for-all module set. Cannot be skipped. Tracked centrally so a manager can see who's behind on the baseline." />
        </Subsection>

        <Subsection
          icon={<ClipboardList className="w-4 h-4 text-[#B8945F]" />}
          title="Role-specific training"
          subtitle="Different curricula per role — intake admin, paralegal, attorney, accounting. Auto-assigned based on staff_members.intake_portal_role."
        >
          <ComingSoon note="Per-role module sets (intake script handling, paralegal review checklist, attorney sign-off flow, trust accounting basics, etc.). New modules get pushed to existing staff in their role band." />
        </Subsection>

        <Subsection
          icon={<UserCheck className="w-4 h-4 text-[#B8945F]" />}
          title="Completion tracking"
          subtitle="Per-employee record of what each staffer has completed, when, and how long it took. Manager view rolls up across the firm."
        >
          <ComingSoon note="Future surface: per-staff timeline, completion percentage, and a firm-wide rollup for the Law Firm Owner / Super Admin to see who's caught up." />
        </Subsection>

        {/* Attorney CLE reminders — attorney-tier only. CLE is licensing-specific
            and only relevant to attorneys, so non-attorney staff don't see this. */}
        {isAttorneyRole && (
          <Subsection
            icon={<Scale className="w-4 h-4 text-[#B8945F]" />}
            title="Attorney CLE reminders"
            subtitle="Continuing Legal Education tracking — separate from the platform-onboarding training above."
            attorneyOnly
          >
            <ComingSoon note="Reminder to design. Planned: upcoming CLE deadlines per attorney, hours remaining by category (ethics, technology, substantive law, etc.), and proof-of-completion uploads tied to each attorney's bar number / jurisdiction." />
          </Subsection>
        )}
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
            Platform training for staff. Required for everyone, with a 30-day tutorial for new hires and role-specific modules.
            Subsections are frozen here; data + module content + enforcement land in the follow-up build.
          </p>
        </div>
      </div>
    </div>
  );
}

function Subsection({ icon, title, subtitle, attorneyOnly, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  attorneyOnly?: boolean;
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
            {attorneyOnly && (
              <span className="text-[9px] uppercase tracking-widest text-[#B8945F] font-semibold">
                attorney only
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
