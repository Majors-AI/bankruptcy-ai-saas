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
  MessageSquare, Sparkles, BookOpen, Mail, Pencil,
  Target, BarChart2, Plus, Save, Calendar,
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

              {/* Electronic agreement + login restrictions */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAF7] mb-1.5">
                  Electronic agreement & login restrictions
                </p>
                <ul className="text-[11px] text-[#6B6B66] leading-relaxed list-disc pl-4 space-y-0.5">
                  <li>
                    <span className="text-[#FAFAF7] font-semibold">Electronic agreement</span> —
                    employee e-signs an employment / handbook agreement during onboarding;
                    store the signed document + timestamp + IP on the staff_members record.
                  </li>
                  <li>
                    <span className="text-[#FAFAF7] font-semibold">Must clock in to access</span> —
                    employees CANNOT enter the dashboard or any working surface until they clock in.
                    PIN login alone does NOT grant access; the front-end gate
                    (<code className="font-mono text-[#FAFAF7]">ForceClockInOverlay</code> in
                    LegalAdminPortal) enforces this today. Back this with a server-side check
                    once the time-tracking backend lands so the rule survives a tampered client.
                  </li>
                  <li>
                    <span className="text-[#FAFAF7] font-semibold">Login restrictions</span> —
                    per-employee toggles: allowed IP range / device fingerprint allowlist,
                    allowed-hours window (e.g. only between scheduled shift + grace period),
                    max concurrent sessions, force re-PIN on idle (auto-logout at 15 min is
                    already wired client-side).
                  </li>
                  <li>
                    <span className="text-[#FAFAF7] font-semibold">Access scope</span> —
                    which portals + departments the employee can sign into, derived from
                    their role + department assignment above.
                  </li>
                  <li>
                    <span className="text-[#FAFAF7] font-semibold">Excused absence policy</span> —
                    the agreement must address what qualifies as an excused absence
                    (illness, family emergency, jury duty, bereavement, FMLA-eligible
                    leave, court appearance, approved PTO/STO) and what's required of the
                    employee (notice window, documentation when applicable, supervisor
                    notification, who covers their day). Mirrors the planned
                    reason-type set the time-tracking backend will accept on
                    <code className="font-mono text-[#FAFAF7]"> intake_staff_time_off </code>
                    + the absence routing surfaced from the clock-in gate.
                  </li>
                </ul>
              </div>
            </div>

            <p className="mt-3 text-[10px] text-[#6B6B66] italic">
              Reference only — the form, validation, and persistence land in the follow-up build.
              Clock-in gate is already enforced on the front end (LegalAdminPortal /
              IntakePortalInner). Server-side enforcement + the electronic agreement +
              login restriction controls are still to be wired.
            </p>
          </div>
        </Subsection>

        <Subsection
          icon={<MessageSquare className="w-4 h-4 text-[#B8945F]" />}
          title="Automated messaging & AI follow-up"
          subtitle="Templates, scripts, and the firm's authorized knowledge base — design only, nothing here sends."
        >
          {/* Static notes / placeholders only. No persisted inputs. No sends.
              Documents the planned shape so the build inherits a frozen
              spec instead of redesigning from scratch. */}
          <div className="space-y-4">

            {/* ── 1) Custom message templates ────────────────────────────── */}
            <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Pencil className="w-3.5 h-3.5 text-[#B8945F]" />
                <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
                  Custom message templates
                </p>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
                  Coming soon — reminder to design
                </span>
              </div>
              <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
                A library of message templates the firm maintains. Editable per firm; the
                same surface drives SMS + email versions of each scenario. Seeded placeholders
                below — text is illustrative and meant to be edited.
              </p>

              <ul className="space-y-3">
                <MessageTemplatePlaceholder
                  label="Running late — courtesy heads-up"
                  trigger="~5 min after a missed start time"
                  channels={["SMS", "Email"]}
                  body="Hi {first_name} — quick courtesy note: we're running a few minutes behind on your appointment. Thanks for your patience; we'll be with you shortly."
                />
                <MessageTemplatePlaceholder
                  label="Sorry we missed you — reschedule"
                  trigger="~1 hour after a missed appointment"
                  channels={["SMS", "Email"]}
                  body="Hi {first_name} — I'm sorry we missed you today. If you could let us know the best time to reschedule, we'd love to find a window that works."
                />
                <MessageTemplatePlaceholder
                  label="We missed you — office aware"
                  trigger="Internal-flag fallback when client hasn't responded"
                  channels={["SMS", "Email"]}
                  body="We missed you. Our office is aware and will contact you as soon as we are able."
                />
              </ul>

              <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
                {/* TODO Phase B — wiring needs:
                    - new table `firm_message_templates (id, firm_id, key, channel,
                      label, trigger_rule, body_md, last_edited_by, last_edited_at)`
                    - per-template channel toggles + variable interpolation
                      ({first_name}, {appt_time}, etc.)
                    - dispatch on the planned Twilio (SMS) / SendGrid (email) wiring;
                      respect the consent system's opt-out flag before queueing
                    - audit trail so a firm can see who edited which template when */}
                Reference only. Real edits + sends require the firm-template store, consent
                checks, and Twilio / SendGrid dispatch — all flagged elsewhere.
              </p>
            </div>

            {/* ── 2) AI follow-up scripts ────────────────────────────────── */}
            <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#B8945F]" />
                <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
                  AI follow-up scripts
                </p>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
                  Coming soon — reminder to design
                </span>
              </div>
              <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-2">
                Firms can configure AI-generated follow-up scripts per scenario. The model
                produces a first-draft message in the firm's voice; staff reviews + edits
                + sends. Same draft pipeline the dashboard's quick-reply popovers preview
                (CommsPillBar / FloatingChat), surfaced here for firm-level configuration.
              </p>
              <ul className="text-[11px] text-[#6B6B66] leading-relaxed list-disc pl-4 space-y-0.5">
                <li>Scenarios: missed appointment · post-consult retention nudge · stale lead re-engagement · post-retainer welcome · appointment confirmation 24h ahead · post-decline win-back.</li>
                <li>Per-scenario tone settings (formal / casual / warm), max length, channel (SMS / email / both).</li>
                <li>Per-firm voice notes the model uses as a system prompt seed.</li>
                <li>Draft preview + edit before send — never auto-send without staff approval.</li>
              </ul>
              <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
                {/* TODO Phase B — Anthropic API wiring:
                    - new table `firm_ai_scripts (id, firm_id, scenario, system_prompt_seed,
                      tone, max_length, channel, last_edited_by, last_edited_at)`
                    - server-side draft endpoint that fetches the firm's seed + lead context,
                      calls Anthropic, returns the draft + a token-cost stamp
                    - rate-limit + per-firm budget controls
                    - staff approval queue — drafts land in the same Messaging tabs the
                      dashboard's existing quick-reply popovers already route to */}
                Anthropic wiring + firm-voice config land in the follow-up build. The dashboard
                draft-preview pipeline (CommsPillBar quick-reply, FloatingChat) is already in
                place — when the API is wired, the drafts replace today's template seeds.
              </p>
            </div>

            {/* ── 3) Firm knowledge base ─────────────────────────────────── */}
            <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-[#B8945F]" />
                <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
                  Firm knowledge base
                </p>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
                  Coming soon — reminder to design
                </span>
              </div>
              <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-2">
                Each firm supplies their <span className="text-[#FAFAF7] font-semibold">authorized</span>
                {" "}knowledge-base content for the AI to draw on — only what the firm has
                explicitly cleared for AI use. The model never references third-party content
                or external sources outside this corpus.
              </p>
              <ul className="text-[11px] text-[#6B6B66] leading-relaxed list-disc pl-4 space-y-0.5">
                <li>Content types: firm bio · attorneys + bios · practice areas · fee policies · intake FAQ · jurisdiction-specific notes · approved client-communication snippets.</li>
                <li>Upload formats: paste / markdown / PDF (extract text on upload).</li>
                <li>Per-document toggle: "authorized for AI use" — required-on flag.</li>
                <li>Versioning: every edit creates a new immutable revision; only the latest authorized version is fed to the model.</li>
                <li>Audit: log which document chunks contributed to which AI draft.</li>
                <li>Scope: AI ONLY draws from this corpus + the specific lead's context — no open-web retrieval.</li>
              </ul>
              <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
                {/* TODO Phase B — storage + retrieval:
                    - new table `firm_kb_documents (id, firm_id, kind, title, body_md,
                      version, authorized_for_ai, uploaded_by, uploaded_at, supersedes_id)`
                    - chunking + embedding store (pgvector or Supabase Vector) for the
                      retrieval step; only chunks from documents where authorized_for_ai=true
                      are indexed
                    - retrieval gate enforced server-side: the AI draft endpoint refuses
                      to retrieve from any unauthorized chunk
                    - audit table `firm_kb_retrieval_log (draft_id, chunk_ids, used_at)` */}
                Reference only. Storage + retrieval (embedding store, authorization gate,
                audit log) ship with the AI draft endpoint above.
              </p>
            </div>

          </div>
        </Subsection>

        <Subsection
          icon={<Target className="w-4 h-4 text-[#B8945F]" />}
          title="Performance Goals"
          subtitle="Custom metrics, per-person quarterly goals, history. Department supervisors + super admins can set/adjust; everyone else view-only."
        >
          {/* Static scaffold only. NO fabricated numbers, NO persisted data,
              NO backend calls. The role gate, metric storage, goal storage,
              and history charting all need a backend that isn't wired.

              Where the user-facing copy below references "you" or "your
              department," the runtime gate (TODO) is:
                - Department supervisor (any department) → can set goals for
                  employees within that department only
                - Super admin / firm owner → can set goals for any employee
                - All other roles → view-only

              The SuperAdminConsole page itself is gated to firm super-admin
              by App.tsx; this subsection's "set/adjust" UI is what flips on
              for supervisors elsewhere (or for super admins here). View-only
              consumers see the chart + goal table from the productivity
              reporting surface (SuperAdminPortal). */}
          <div className="space-y-4">

            {/* Role-gate scaffold notice */}
            <div className="rounded-lg border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-2">
              <div className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-[#B8945F] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#FAFAF7] leading-snug">
                    Access scaffold — supervisors set their own department; super admins set anyone.
                  </p>
                  <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-relaxed">
                    {/* TODO Phase B — role gate enforcement:
                        - read viewer.role + viewer.department_id at the controller level
                        - filter the per-person form's employee picker to viewer's
                          department when role === "department_supervisor"
                        - server-side INSERT guard: reject goal writes whose
                          target_staff_id sits outside the supervisor's department
                        - view-only role variants of every block below render the
                          same chrome with all inputs disabled + a "View only" chip */}
                    Viewers without set-permission see the same chrome with disabled inputs
                    and a "View only" chip. Wiring lives in the planned staff-setup model.
                  </p>
                </div>
              </div>
            </div>

            {/* ── 1) Custom metrics ──────────────────────────────────────── */}
            <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Pencil className="w-3.5 h-3.5 text-[#B8945F]" />
                <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
                  Custom metrics
                </p>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
                  Coming soon — reminder to design
                </span>
              </div>
              <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
                Define the metrics a firm tracks against. Each metric ties to a measurable
                task outcome (the same outcomes the dashboard's intake_contact_log /
                intake_leads.status already emit). Below are illustrative starters —
                firms add, edit, and retire metrics from this list.
              </p>

              <ul className="space-y-2">
                <MetricDefinitionPlaceholder
                  name="Calls made"
                  description="Outbound calls logged in intake_contact_log (any outcome)."
                  source="intake_contact_log · direction='outbound'"
                />
                <MetricDefinitionPlaceholder
                  name="Appointments set"
                  description="Leads transitioned to status='consultation_scheduled' by this staffer."
                  source="intake_leads.status transitions"
                />
                <MetricDefinitionPlaceholder
                  name="Presented"
                  description="Cases presented after attorney acceptance (status='attorney_accepted' → 'fee_quoted' transitions)."
                  source="intake_leads.status transitions"
                />
                <MetricDefinitionPlaceholder
                  name="Retained"
                  description="Leads that reached status='retained' attributed to this staffer."
                  source="intake_leads.status='retained' + retained_at"
                />
              </ul>

              <button
                disabled
                title="Add metric — storage not wired"
                className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B6B66] border border-dashed border-[#3A3A36] px-2 py-1 rounded cursor-not-allowed opacity-70"
              >
                <Plus className="w-3 h-3" /> Add metric
              </button>

              <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
                {/* TODO Phase B — metric storage:
                    - new table `firm_perf_metrics (id, firm_id, key, label,
                      description, source_query, unit, created_by, created_at)`
                    - per-firm CRUD UI replaces this static list
                    - validation: source_query must reference an allow-listed
                      table/column set (intake_leads, intake_contact_log,
                      calendar_events) to prevent arbitrary SQL
                    - retirement instead of deletion (preserve historical
                      goal records that reference the metric) */}
                Reference only. Metric definitions land with the
                <code className="font-mono text-[#FAFAF7]"> firm_perf_metrics </code>
                table + allow-listed source_query validator.
              </p>
            </div>

            {/* ── 2) Per-person quarterly goals ──────────────────────────── */}
            <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-[#B8945F]" />
                <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
                  Per-person quarterly goals
                </p>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
                  Coming soon — reminder to design
                </span>
              </div>
              <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
                Set one goal per (employee × metric × quarter). Supervisors set goals for
                their own department; super admins for anyone. Goals are immutable once the
                quarter ends — historical records keep the original target value alongside
                the actual.
              </p>

              {/* Disabled scaffold form — illustrative, no submit handler. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <ScaffoldField label="Employee">
                  <select
                    disabled
                    className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
                  >
                    <option>— pick employee —</option>
                  </select>
                </ScaffoldField>
                <ScaffoldField label="Metric">
                  <select
                    disabled
                    className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
                  >
                    <option>— pick metric —</option>
                  </select>
                </ScaffoldField>
                <ScaffoldField label="Quarter">
                  <select
                    disabled
                    className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
                  >
                    <option>— pick quarter —</option>
                  </select>
                </ScaffoldField>
                <ScaffoldField label="Goal value">
                  <input
                    disabled
                    type="text"
                    placeholder="—"
                    className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed placeholder-[#3A3A36]"
                  />
                </ScaffoldField>
              </div>
              <button
                disabled
                title="Save goal — persistence not wired"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B6B66] border border-dashed border-[#3A3A36] px-2 py-1 rounded cursor-not-allowed opacity-70"
              >
                <Save className="w-3 h-3" /> Save goal
              </button>

              <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
                {/* TODO Phase B — goal storage + role-scoped writes:
                    - new table `firm_perf_goals (id, firm_id, staff_id,
                      metric_id, year, quarter (1-4), goal_value, set_by,
                      set_at, locked boolean DEFAULT false)`
                    - INSERT guard rejects goals targeting staff outside the
                      supervisor's department (super admin bypasses)
                    - quarter-close cron: flip locked=true on Q+1 day-1 so
                      historical records remain immutable
                    - achievement record: a parallel `firm_perf_goal_results
                      (goal_id, actual_value, computed_at)` rolled up nightly
                      from the metric's source_query */}
                Reference only. Persistence + role-scoped INSERT guard + the
                quarter-close lock land with
                <code className="font-mono text-[#FAFAF7]"> firm_perf_goals</code>
                {" "}and its companion results table.
              </p>
            </div>

            {/* ── 3) History + bar chart ─────────────────────────────────── */}
            <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 className="w-3.5 h-3.5 text-[#B8945F]" />
                <p className="text-xs font-semibold text-[#FAFAF7] uppercase tracking-widest">
                  History + chart
                </p>
                <span className="ml-auto text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
                  Coming soon — reminder to design
                </span>
              </div>
              <p className="text-[11px] text-[#6B6B66] leading-relaxed mb-3">
                Bar chart of goal vs. actual per quarter, filtered by year. Each retained
                historical goal report stays accessible after the quarter closes.
              </p>

              {/* Filter row (disabled scaffold). */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <ScaffoldField label="Year">
                  <select
                    disabled
                    className="bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
                  >
                    <option>— pick year —</option>
                  </select>
                </ScaffoldField>
                <ScaffoldField label="Employee">
                  <select
                    disabled
                    className="bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
                  >
                    <option>— all / pick —</option>
                  </select>
                </ScaffoldField>
                <ScaffoldField label="Metric">
                  <select
                    disabled
                    className="bg-[#1A1A18] border border-[#2A2A28] text-[#6B6B66] text-[11px] rounded px-2 py-1.5 cursor-not-allowed"
                  >
                    <option>— pick metric —</option>
                  </select>
                </ScaffoldField>
              </div>

              {/* Chart frame — axes + Q1-Q4 column labels rendered statically,
                  bar area is an explicit empty state. NO fake bars. */}
              <div className="rounded border border-[#2A2A28] bg-[#1A1A18] overflow-hidden">
                <div className="flex items-end px-4 pt-6 pb-3" style={{ height: 200 }}>
                  {/* Y axis — labels only, no scale yet */}
                  <div className="h-full flex flex-col justify-between pr-2">
                    <span className="text-[9px] text-[#3A3A36]">—</span>
                    <span className="text-[9px] text-[#3A3A36]">—</span>
                    <span className="text-[9px] text-[#3A3A36]">—</span>
                    <span className="text-[9px] text-[#3A3A36]">0</span>
                  </div>
                  {/* Chart body — explicit empty state */}
                  <div className="flex-1 border-l border-b border-[#2A2A28] flex items-center justify-center relative">
                    <div className="text-center">
                      <BarChart2 className="w-6 h-6 text-[#3A3A36] mx-auto mb-1" />
                      <p className="text-[11px] text-[#6B6B66] italic">
                        No goal data yet.
                      </p>
                      <p className="text-[10px] text-[#6B6B66] mt-0.5 leading-snug max-w-xs">
                        Wire the metrics backend + at least one closed quarter and bars appear here.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center px-4 pb-2 pl-10">
                  {(["Q1", "Q2", "Q3", "Q4"] as const).map(q => (
                    <span key={q} className="flex-1 text-center text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66]">
                      {q}
                    </span>
                  ))}
                </div>
              </div>

              {/* Legend — kept so the chart "reads" as a goal-vs-actual chart
                  even with the empty body. */}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-[#6B6B66]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#B8945F]/60 border border-[#B8945F]/40" />
                  Goal
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600/40 border border-emerald-700/60" />
                  Actual — hit
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-700/40 border border-red-700/60" />
                  Actual — missed
                </span>
              </div>

              <p className="text-[10px] text-[#6B6B66] italic mt-3 leading-snug">
                {/* TODO Phase B — history + chart data source:
                    - read from `firm_perf_goals` joined with
                      `firm_perf_goal_results` (the achievement record above)
                    - year filter scopes the SELECT; default = current year
                    - hit/miss boolean: result.actual_value >= goal.goal_value
                    - retain historical goal reports indefinitely; quarter-
                      close lock guarantees the original goal_value stays
                      visible alongside actual
                    - chart library: lightweight SVG bars rendered inline
                      (no chart-lib dep) — same approach as ConsultScheduler's
                      bubble grid */}
                Reference only. Bars populate from the goals + results tables
                once they exist.
              </p>
            </div>

          </div>
        </Subsection>
      </div>
    </div>
  );
}

// Disabled scaffold form field with a small label above. No state.
function ScaffoldField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

// Static placeholder card for a single metric definition. Disabled Edit chip.
function MetricDefinitionPlaceholder({
  name, description, source,
}: { name: string; description: string; source: string }) {
  return (
    <li className="rounded border border-[#2A2A28] bg-[#1A1A18] p-3">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <p className="text-[11px] font-semibold text-[#FAFAF7]">{name}</p>
        <span className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded cursor-not-allowed opacity-70" title="Edit metric — storage not wired">
          <Pencil className="w-2.5 h-2.5" /> Editable
        </span>
      </div>
      <p className="text-[11px] text-[#6B6B66] leading-relaxed">{description}</p>
      <p className="text-[10px] text-[#3A3A36] font-mono mt-1">{source}</p>
    </li>
  );
}

// Static-only placeholder card for a message template entry. No edit input,
// no save; the "Edit" affordance is a disabled chip noting the wiring is
// pending. Text is intentionally illustrative — firms own the copy once the
// template store lands.
function MessageTemplatePlaceholder({
  label, trigger, channels, body,
}: {
  label: string;
  trigger: string;
  channels: ("SMS" | "Email")[];
  body: string;
}) {
  return (
    <li className="rounded border border-[#2A2A28] bg-[#1A1A18] p-3">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <p className="text-[11px] font-semibold text-[#FAFAF7]">{label}</p>
        <span className="text-[9px] text-[#6B6B66]">· {trigger}</span>
        <div className="ml-auto flex items-center gap-1">
          {channels.map(ch => (
            <span
              key={ch}
              className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#B8945F] border border-[#B8945F]/40 px-1.5 py-0.5 rounded"
            >
              {ch === "SMS" ? <MessageSquare className="w-2.5 h-2.5" /> : <Mail className="w-2.5 h-2.5" />}
              {ch}
            </span>
          ))}
          <button
            disabled
            title="Edit — template store wiring pending"
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded cursor-not-allowed opacity-70"
          >
            <Pencil className="w-2.5 h-2.5" /> Editable
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#6B6B66] leading-relaxed whitespace-pre-line">
        {body}
      </p>
    </li>
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
