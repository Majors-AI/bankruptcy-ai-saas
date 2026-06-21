# Legal Portal — Step-0 Function Mapping

**Branch:** `6.19.26` · **Date:** 2026-06-19
**Reference:** `docs/design/legal-portal-reference.jsx` (1193 lines, 14-stage / 4-phase Pipeline + 3 role tabs)
**Mapping scope:** Every distinct user-facing capability across `LegalDepartmentPortal.tsx`, `LegalAdminPortal.tsx`, `LegalDashboard.tsx`, `legalTasks.ts`, `ParalegalReview.tsx`, `SigningReview.tsx`, `AttorneyIntakeDashboard.tsx`, `Ch13Eligibility.tsx`, `Ch13SigningReview.tsx`, and supporting panels.

**Goal:** confirm nothing currently in the portal disappears in the restyle. Each item is mapped to one of:
- **a reference slot** (header / pipeline / queue / review-workspace / scheduling / finmgmt-gate / client-portal), or
- **"NO HOME — keep reachable via …"** with a specific proposed location outside the reference's case-review surface.

**STOP-FOR-APPROVAL gate:** no UI is built until §8 is signed off.

---

## 1 · Reference layout — target slots

The reference is a tightly scoped **case-review surface**. It has 11 slots:

| # | Slot | Reference line | Visible to |
|---|------|----------------|------------|
| R1 | App header (logo + breadcrumb + role tabs) | 1156–1176 | All roles |
| R2 | Pipeline bar (14 stages / 4 phases + Exception lane + Client-prep parallel track) | 289–346 | Paralegal · Attorney |
| R3 | Queue (Needs you / Waiting on client / All cases filter chips · case rows w/ stage + assignee + next-step) | 1023–1071 | Paralegal · Attorney |
| R4 | Case workspace > Sidebar (paralegal: Schedules + Documents · attorney: Forms to be filed) | 404–425 | Paralegal · Attorney |
| R5 | Case workspace > Main · ScheduleVerify (paralegal value-confirmation checklist) | 727–750 | Paralegal |
| R6 | Case workspace > Main · DocCard (paralegal document open & verify, w/ reject reason capture) | 752–799 | Paralegal |
| R7 | Case workspace > Main · FieldMap (attorney field-mapping · Form preview · Best Case ref tabs · generate filled PDF) | 535–724 | Attorney |
| R8 | Case workspace > Footer (Reject / Confirm CTA · "Send to attorney review" / "Approve for signing") | 458–481 | Paralegal · Attorney |
| R9 | Scheduling view (3-step: client offers → attorney picks → client confirms · email + SMS notify) | 871–988 | Paralegal · Attorney · Client |
| R10 | FinMgmtGate view (debtor-education completion confirm → firm files Form 423 → gate to discharge) | 990–1016 | Paralegal · Attorney · Client |
| R11 | ClientPortal (to-do list w/ active/ready/locked tiers · timeline · safety advisory) | 1073–1141 | Client |

**Key reference omissions** (capabilities NOT present in the reference; must be flagged "NO HOME — keep reachable"):
- No **Leads** tab (pre-conversion intake_leads; reference assumes submission already happened — case enters queue at `submitted` stage).
- No **Calendar** tab (full month/week scheduler · staff availability · time-off).
- No **Messages** tab.
- No **My Tasks / Staff Tasks** tab.
- No **My Schedule / time-off** tab.
- No **Staff Settings** (CRUD on staff/roles/departments).
- No **Department Settings** (IRS standards · exemption overrides · AI prompts).
- No **Out-of-Office Admin / Sick Admin** tab.
- No **Manual Clients** legacy V1 tab.
- No **floating chat** widget.

These need an explicit home outside the 11-slot reference surface. Section 6 proposes: a **left utility rail** (icons-only `Settings · Calendar · Messages · Tasks · Leads`) anchored alongside the role tabs in the header — outside the Pipeline + Queue + Case-workspace flow, so the reference remains visually intact but the back-office surfaces stay reachable.

---

## 2 · Role mapping (current → reference)

Current portal has 7 roles; reference exposes 3 role tabs.

| Current role | Reference tab | Notes |
|--------------|---------------|-------|
| `legal_admin` | **Paralegal** + utility rail access to Leads/Calendar/Messages/Tasks/Staff Settings | Power user — sees the queue and back-office. |
| `attorney` | **Attorney** | Review Queue + case workspace + signing review + Ch.13 engine. |
| `paralegal` | **Paralegal** | Queue + paralegal review workspace. No back-office. |
| `attorney_super_admin` | **Attorney** + utility rail access to Department Settings (IRS · exemptions · AI prompts) + Staff Settings | Adds settings gates. |
| `super_admin` (firm) | **Paralegal** OR **Attorney** + utility rail full · Out-of-Office Admin | Role-switching toggle preserved from current TABS. |
| `department_supervisor` | Paralegal/Attorney by department + Staff Settings utility | Per-department gates preserved. |
| `super_admin_bankruptcy_ai` (platform_owner) | **Attorney** + Full utility rail + Cross-firm admin | Platform-tenant role; no current changes needed. |
| **Client** (client portal) | **Client portal** | New: surfaces ClientDashboard's task feed in the reference's to-do/timeline shape. |

**§8 Q1 RESOLVED:** 3 role tabs (Paralegal / Attorney / Client) — confirmed. `legal_admin` rides the Paralegal tab visually but **admin actions are gated to the utility rail**, NOT exposed inside the Paralegal tab's panels. Paralegals never see admin controls through the tab UI. Role-gate check happens both at the rail-icon level AND inside each panel's actions (defense-in-depth — utility rail visibility doesn't replace per-action role checks).

---

## 3 · Pipeline-stage mapping (current → reference 14 stages)

The reference's 14 stages drive the Pipeline bar (R2). Mapping current signals onto them:

| Reference stage | Phase | Source-of-truth in current system | Notes |
|-----------------|-------|-----------------------------------|-------|
| `submitted` | Prepare | `intake_leads.status = 'intake_complete'` OR `sent_for_review = true` OR `intake_completed = true` | After questionnaire submit. |
| `paralegal` | Prepare | `paralegal_reviews.status IN ('in_progress','needs_info')` | Active paralegal verification. |
| `fixes` | Prepare | `paralegal_reviews.status = 'needs_info'` OR `section_confirmations.status = 'needs_info'` OR `doc_confirmations.status = 'rejected'` | Waiting on client. |
| `attorney` | Prepare | `attorney_intake_reviews.decision = 'pending'` OR `signing_reviews.status = 'in_progress'` (pre-approval) | Active attorney review. |
| `approved` | Prepare | `attorney_case_acceptances.decision = 'accepted'` AND retainer signed AND signing not yet scheduled | Waiting on client fee + counseling. |
| `schedule` | Sign & file | `attorney_case_acceptances.decided_at` set AND no calendar_event with type=signing AND ready_to_proceed flag | Signing not yet scheduled. |
| `sign_done` | Sign & file | calendar_events (type=signing, status=completed) AND `signing_reviews.status = 'completed'` | Signing done, pre-file. |
| `filed` | Sign & file | `accounting_filed_case_registry` row exists OR `intake_leads.status = 'filed'` | Court accepted petition. |
| `m341_docs` | Administration | trustee_341_checklist_state flag (DEFERRED — schema TODO §1 / §10 in `schema-changes-for-canelo.md`) | Pre-341 doc requests. |
| `m341_submitted` | Administration | trustee_docs_submitted_at set (DEFERRED — schema TODO) | Awaiting 341. |
| `m341_concluded` | Administration | 341_concluded_at set (DEFERRED — schema TODO) | 341 done. |
| `finmgmt` | Administration | `client_documents.cc_course_completed_at` set AND Form 423 not yet filed (schema §7) | Course done, firm files. |
| `discharge` | Discharge | discharge_entered_at (DEFERRED — schema TODO) | Discharge granted. |
| `closed` | Discharge | case_closed_at (DEFERRED — schema TODO) | Case closed. |

**Exception lane** (Post-petition issue):
- Drive from: `acceptances.override_required = true` (post-acceptance attorney override) OR open ECF amendment_flag (DEFERRED).

**Client-prep parallel track** (Credit counseling + Filing fee · pre-Schedule gate):
- Credit counseling: `client_documents.cc_course_completed_at` set.
- Filing fee: payment row in payments table where type='court_filing_fee' AND status='paid' (DEFERRED — confirm schema with Canelo before wiring).

**Decision needed (§8 Q2):** confirm the 8 stages we have signals for today vs the 6 we'd stub. Phase-1 timeline shell in `src/components/file-timeline/FileTimeline.tsx` already stubs `m341_*` / `discharge` / `closed`; the reference adopts the same stance.

---

## 4 · Function-by-function mapping

### A · `LegalDepartmentPortal.tsx` (340-line shell)

| Capability | Reference slot | Notes |
|------------|----------------|-------|
| PIN-gate staff login (DepartmentPortalLogin) | **PRE-SHELL** (outside R1–R11) | Auth wrapper preserved; sits in front of the new shell. |
| Section type (`tasks / paralegal_review / signing_review / file_cabinet / calendar / time_fees`) | Replaced by R1 role tabs + utility rail | Sections collapse: `tasks` → role-default landing (R3 Queue); `paralegal_review` → R4–R8 paralegal case workspace; `signing_review` → R4–R8 attorney case workspace; `file_cabinet` → utility rail "Documents"; `calendar` → utility rail "Calendar"; `time_fees` → utility rail "Time & Fees". |
| Promise.all data fetches (attorneyIntakeReviews, signingReviews, paralegalReviews, ecfTasks, intakeLeads, calendarEvents, acceptances, ecfInbox, filedRegistry) | Preserved verbatim · feed R3 Queue + R4 Sidebar | Identical fetches; the new shell mounts at the same level. |

### B · `LegalAdminPortal.tsx` (9881 lines · main back-office)

#### B-1 · Tabs (`TABS` constant ~line 9113)

| Current tab | Reference slot |
|-------------|----------------|
| Dashboard (legal_admin / super_admin) | **NO HOME — keep reachable via** utility rail "Home" icon — surfaces IntakeDashboard + LeadsByMonthChart + CaseActivityLog. Out of scope for the reference's case-focused queue, but firm operations needs it. |
| Leads | **NO HOME — keep reachable via** utility rail "Leads" icon. Reference assumes submission already happened; pre-submission leads live here. |
| Follow-Up / Review Queue | **R3 Queue** (renamed "Your case queue") — for attorneys this *is* the review queue. legal_admin sees the same R3 Queue with stage filtering. |
| Calendar | **NO HOME — keep reachable via** utility rail "Calendar". Reference's R9 Scheduling is per-case; full month/week + staff availability stays separate. |
| Messages | **NO HOME — keep reachable via** utility rail "Messages". |
| My Tasks / Staff Tasks | Partially absorbed by **R3 Queue** (case-bearing tasks). Non-case tasks → utility rail "Tasks". |
| My Schedule | **NO HOME — keep reachable via** utility rail "My Schedule" (time-off, availability self-service). |
| Staff Settings | **NO HOME — keep reachable via** utility rail "Settings → Staff". |
| Department Settings | **NO HOME — keep reachable via** utility rail "Settings → Department" (IRS standards · exemption overrides · AI prompts). |
| Out-of-Office Admin / Sick Admin | **NO HOME — keep reachable via** utility rail "Settings → Out-of-Office" (super_admin only). |
| Manual Clients (V1) | **NO HOME — keep reachable via** utility rail "Manual Clients". V1 legacy; gate by canCreateClient. |

#### B-2 · Dashboard tab contents

| Capability | Reference slot |
|------------|----------------|
| IntakeDashboard widget grid | NO HOME — utility rail "Home". |
| LeadsByMonthChart (12-month) | NO HOME — utility rail "Home". |
| CaseActivityLog (contact-log timeline) | NO HOME — utility rail "Home". Also reachable inside lead-detail (see B-4). |
| ClientTimeLog (time-clock widget) | NO HOME — utility rail "Home" footer chip, or staff-profile dropdown. |
| FloatingChat (persistent) | NO HOME — persists across the new shell as today; bottom-right anchor. |

#### B-3 · Leads tab — list view

| Capability | Reference slot |
|------------|----------------|
| Lead table (name/phone/email/status/assigned/follow-up queue/urgency/last-contact/next-follow-up) | NO HOME — utility rail "Leads" list. Distinct from R3 Queue (which is *submitted* cases). |
| Status badges (12 statuses) | NO HOME — reused inside the Leads list. The reference's `Pill` primitive (lines 268–277) can render them identically. |
| Urgency badges (normal / urgent / emergency) | NO HOME — reused inside the Leads list. |
| Bulk actions (view/assign/schedule/log/request-intake/send-for-review) | NO HOME — utility rail "Leads" list row actions. |
| Lead-claim lock + LeadClaimBanner | NO HOME — utility rail "Leads" detail header. **Important: when the lead converts to a case it lands in R3 Queue and the claim is the assigned paralegal/attorney shown in the row.** |

#### B-4 · Lead detail modal (LegalAdminPortal ~line 3000+)

| Capability | Reference slot |
|------------|----------------|
| Lead Info Panel (name/phone/email/status/assigned/urgency/source/pre-screen notes/follow-up queue toggle) | NO HOME — utility rail "Leads → detail". |
| Contact Log (inbound/outbound calls, SMS, email, AI; channel + direction + outcome + notes) | NO HOME — utility rail "Leads → detail → Contact Log tab". |
| Intake Submission collapsed card (filing type, identity, debts, income/expenses, assets, history flags) | NO HOME — utility rail "Leads → detail → Intake Summary tab". |
| Buttons (Review Intake / Update Intake Info / Log Contact / Schedule Consult / Send for Review) | NO HOME — utility rail "Leads → detail" action bar. |
| Attorney Review button | **Routes into R3 → R4–R8 case workspace** once the lead is converted; pre-conversion, lives in Leads detail. |

#### B-5 · Modals

| Modal | Reference slot |
|-------|----------------|
| **IntakeAttorneyReviewModal** (4-tab: Eligibility / Issues / All Answers / Decision) | **R4–R8 case workspace, Attorney role.** Specifically: R4 sidebar = the 4 tabs; R7 Main = each tab's panel; R8 Footer = the existing Decision-tab save button + the hard accept gate. **Note: the reference's R7 FieldMap is form-by-form; the current modal is review-by-review. The Attorney case workspace gets a tab switcher *above* R7 that toggles between "Eligibility / Issues / Decision" and the form-mapping view.** |
| **AttorneyAcceptanceModal** (simplified acceptance-only) | Absorbed into the Decision tab of the case workspace (above). No standalone modal in the reference. |
| **NewLeadModal** (inline lead creation) | NO HOME — utility rail "Leads → + New Lead". |
| **CaseAdvancementStatusBar** (Presentation scheduled / Presented) | Absorbed into **R2 Pipeline** as part of the `approved` → `schedule` transition. Date-picker reachable from R3 case row or R4 sidebar action menu. |
| **LogContactModal** | NO HOME — utility rail "Leads → detail" (pre-conversion) or available from R3 case row "…" menu (post-conversion). |
| **ScheduleConsultModal** (calendar picker + slot grid + ConsultSchedulerPanel) | NO HOME — utility rail "Calendar" for the underlying month/week + per-staff availability. *Per-case* signing scheduling lives in **R9 Scheduling** (3-step flow). |
| **UpdateIntakeInfoModal** | NO HOME — utility rail "Leads → detail" pre-conversion; post-conversion via R4 sidebar action. |
| **AllAnswersView modal** (read-only questionnaire expansion) | **R7 Main · "All Answers" tab** inside the attorney case workspace (one of the form-mapping tabs proposed above). |

#### B-6 · User actions (button onClicks)

Grouped — these all live where their parent modal/tab lives:

| Action group | Reference slot |
|--------------|----------------|
| Lead CRUD (New Lead, View Details, Assign, Schedule Consult, Log Contact, Request Intake, Send for Review, Review Intake, Update Intake Info, Claim Lead) | NO HOME — utility rail "Leads". |
| Attorney decision CRUD (Attorney Review, Accept/Decline, save acceptance, save decision notes) | **R4–R8 case workspace** (Attorney role). |
| Staff CRUD (Schedule Staff Availability, Edit Staff Member, Mark Sick, IAmSickButton) | NO HOME — utility rail "Settings → Staff" + "My Schedule". |
| Firm CRUD (Update Firm Settings, IRS auto-fill toggle, Living Standards adjustments, Exemption overrides, AI intake prompts) | NO HOME — utility rail "Settings → Department". |
| Refresh / load() Promise.all | Survives unchanged — fires on shell mount + on role-tab switch. |

#### B-7 · Role gates

| Gate | Reference posture |
|------|-------------------|
| canManageLeads (legal_admin · super_admin) | Gates utility rail "Leads" + New Lead. |
| canManageStaff (super_admin · department_supervisor) | Gates utility rail "Settings → Staff". |
| isSuperAdmin | Gates utility rail "Settings → Out-of-Office" + cross-department views. |
| canCreateClient | Gates utility rail "Manual Clients". |
| attorney_super_admin / law_firm_owner | Gates AI-intake-prompt edits inside Department Settings. |
| platform_owner (super_admin_bankruptcy_ai) | Out of scope for this restyle — DO NOT touch (per CLAUDE.md "Do not touch the multi-tenant foundation"). |

#### B-8 · Specialized components inside LegalAdminPortal

| Component | Reference slot |
|-----------|----------------|
| IntakeDashboard | NO HOME — utility rail "Home". |
| LeadsByMonthChart | NO HOME — utility rail "Home". |
| CaseActivityLog | NO HOME — utility rail "Home" + "Leads → detail". |
| LeadClaimBanner | Visible inside R3 Queue case row (claim/initials shown alongside assignee). |
| CaseAdvancementStatusBar | Absorbed into R2 Pipeline + R3 next-step text. |
| ConsolidatedMessagingWidget | NO HOME — utility rail "Messages". |
| FloatingChat | NO HOME — persists across all views. |
| StaffGuidedIntake | NO HOME — launchable from utility rail "Leads → detail → Launch Guided Intake". |
| NewLeadInline | NO HOME — utility rail "Leads → + New Lead". |
| ConsultSchedulerPanel | NO HOME — utility rail "Calendar". |
| AllAnswersView | **R7 Main · "All Answers" tab.** |
| UpdateIntakeInfoModal | NO HOME — utility rail "Leads → detail". |
| CaseAcceptanceFlow | Absorbed into R4–R8 Attorney case workspace Decision tab. |
| ClientTimeLog | NO HOME — utility rail footer. |

#### B-9 · Computed values / engine outputs (these are *data*, not UI — listed for completeness)

| Computed | Surfaces in |
|----------|-------------|
| ch7_eligible / ch13_eligible | R4–R8 Attorney case workspace · Eligibility tab. |
| meanTestResult (firm DMI triage) | R4–R8 · Eligibility tab. |
| disposableIncome | R4–R8 · Eligibility tab + R7 FieldMap for Schedule J (Form B 122A). |
| firmDmiThreshold / firmMinDebt | R4–R8 · Eligibility tab (auto-seeded issues). |
| Non-exempt vehicle equity | R4–R8 · Eligibility tab; also R7 FieldMap for Schedule C exemption rows. |
| Preferential payment totals (insider / non-insider) | R4–R8 · Issues tab (auto-seeded). |
| Issue auto-seeding (firm minimum debt, firm DMI triage, unfiled tax returns, lawsuit/garnishment/transfer/preferential payment) | R4–R8 · Issues tab. |

### C · `ParalegalReview.tsx`

| Capability | Reference slot |
|------------|----------------|
| Tab: Document Verification | **R4 Sidebar (Documents section) → R6 DocCard.** |
| Tab: Value Confirmation | **R4 Sidebar (Schedules section) → R5 ScheduleVerify.** |
| Tab: Summary | Absorbed into R4 sidebar progress chip (confirmedCount/total) + R8 footer status line. |
| Document Sections (Identity & Certs · Supporting Docs · Petition Schedules · Pre-Filing Checklist · Client Signing Session) | **R4 Sidebar groups.** Reference today groups Schedules separately from Documents; current 5-section taxonomy collapses to "Schedules" (Petition Schedules grouped by Schedules A–J / Means test / SOFA) + "Documents" (Identity · Supporting · Pre-Filing · Signing Session). |
| Per-document card (status pending/confirmed/needs_info/rejected/transferred/duplicated · paralegal note · rejection reason · transfer-to-section) | **R6 DocCard** (reject reason captured in the existing modal at reference line 484–498). Reference has 3 statuses (`pending / confirmed / flagged`); current 6 statuses compress to those 3 + the rejection modal stores the reason + needs_info as a sub-state. The `transferred` and `duplicated` sub-states need preservation — flag as **NO HOME — keep as inline pill on R6 DocCard** ("Transferred to: <section>" badge). |
| Per-section summary (overall status · Confirm button · Request Info toggle) | **R8 Footer "Send to attorney review" button** gates on section-summary completion. Per-section confirm absorbed into R4 sidebar progress. |
| Data fetches (paralegal_reviews · doc_confirmations · section_confirmations · client_documents) | Preserved verbatim — feeds R4–R6. |
| User actions (Confirm Doc · Reject Doc · Transfer Doc · Mark Section Complete · Request Info · Add Paralegal Note) | All preserved inside R4–R8 paralegal case workspace. |
| Role gate: paralegal full CRUD · attorney read-only via `layout` prop | Preserved via R1 role tab (paralegal vs attorney). |

### D · `SigningReview.tsx`

| Capability | Reference slot |
|------------|----------------|
| Tabs: Identity & Certs · Supporting Docs · Petition Schedules · Pre-Filing Checklist · Client Signing Session | **R4 Sidebar groups (Attorney role).** "Forms to be filed" in the reference (line 413) is the same idea. |
| 31-item review checklist (status: not_yet_reviewed / verified / needs_correction · per-item notes · reviewer + timestamps) | **R7 FieldMap** per form — the existing checklist absorbs into per-form field-confirmation. Free-text notes captured via the per-item "Flag value" reject modal (R8 footer). |
| ExemptionsLiquidationPanel | **R4–R8 case workspace · "Exemptions" sidebar entry → R7 Main panel** (custom body, separate from FieldMap because the panel computes the § 1325(a)(4) floor + ties to Schedule C). |
| MaritalAdjustmentPanel | **R4–R8 case workspace · "Marital adjustment" sidebar entry → R7 Main panel** (custom body for Form 122A-1 line 17a). |
| LongFormDeductionPanel | **R4–R8 case workspace · "Long-form deductions" sidebar entry → R7 Main panel** (Schedule J / IRS standards adjustments + audit log + reason capture). |
| Ch13SigningReview (chapter-13 cramdown engine + secured-claim bifurcation) | **R4–R8 case workspace · "Ch.13 cramdown" sidebar entry → R7 Main panel** (custom body wrapping `Ch13Eligibility`). |
| User actions (Mark Verified · Mark Needs Correction · Add Note · Save & Close · Pause · Set Exemption Totals · Set Marital Adjustment · Set Long-Form Deductions · Override Till Rate · Override Priority Claims · Reclassify Secured Claim) | All preserved inside R4–R8 case workspace. Save & Close → R8 footer "Approve for signing". |
| Role gates (ALLOWED_ROLES = attorney / legal_admin / firm_super_admin / super_admin_bankruptcy_ai · non-lawyers read-only on Ch.13 Decision tab + secured-claim reclassification) | Preserved via R1 role tab + per-action role check inside R7 panels. |

### E · `Ch13Eligibility.tsx`

Lives inside R4–R8 case workspace · "Ch.13 cramdown" sidebar entry → R7 Main panel (custom body).

| Capability | Notes |
|------------|-------|
| Engine inputs (WSJ Prime · risk premium · till rate override · filing date · per-claim FMV · per-claim purchase date · per-claim SOI · per-claim reclassification toggle · priority override · conduit toggle · junior liens) | All preserved verbatim — rendered inside the Ch.13 panel. Attorney-only writes; paralegal sees read-only. |
| Computed outputs (till rate · per-claim bifurcation · monthly amortization · plan cost · monthly plan payment · § 1325(a)(4) test · commitment period) | All preserved verbatim. |
| Audit log (rulesAuditStore.recordChange) + per-field free-text reason capture | All preserved verbatim — feeds the same `acceptances.override_explanation` column proposed in schema §6. |

### F · `Ch13SigningReview.tsx`

Lives inside R4–R8 case workspace · "Ch.13" view-mode (driven by R3 case row's `chapter` field).

| Capability | Notes |
|------------|-------|
| ReviewShell 4-tab container (Eligibility/Summary · Issues · All Answers · Decision) | Becomes the **R7 Main panel tab switcher** inside the Attorney case workspace (matches the IntakeAttorneyReviewModal mapping in B-5). |
| Derived inputs threaded to Ch13Eligibility (household size · CMI · median annual · plan months · filing venue · secured claims · best-interests floor · mortgage arrears in plan · ongoing mortgage · priority claims) | All preserved — derived on mount of the Ch.13 panel. |
| Stub demo data (2022 Camry · 2018 Civic) when form_data empty | **DROP** in the new shell per the user's "Do NOT ship the mock data" directive. R7 instead shows "not yet wired" empty state. |

### G · `AttorneyIntakeDashboard.tsx`

Lives inside R4–R8 case workspace · Attorney role (pre-acceptance).

| Capability | Reference slot |
|------------|----------------|
| Eligibility panel (debt composition · asset summary · income/expenses · household size · state exemptions · prior bankruptcies · flags) | **R7 Main · Eligibility tab.** |
| Issues panel (auto-seeded + attorney-added · client acknowledgement w/ initials) | **R7 Main · Issues tab.** Note: the acknowledgement-with-initials mechanic is a hard accept gate per schema §6 — preserved. |
| All Answers panel (read-only questionnaire) | **R7 Main · All Answers tab.** |
| Decision panel (accept/decline · case type · attorney fee · filing fee · down payment · plan months · upfront/plan · limited-scope desc · decision notes) | **R7 Main · Decision tab + R8 Footer "Approve for signing" CTA.** Hard accept gate (acknowledged_issues required, override_required/override_explanation if any critical issue unresolved) preserved. |

### H · `LegalDashboard.tsx` + `legalTasks.ts`

| Capability | Reference slot |
|------------|----------------|
| AllTasksWidget (RED/ORANGE/YELLOW/BLUE color-tiered tasks · mine/shared scope toggle) | **R3 Queue.** The reference Queue's "Needs you / Waiting on client / All cases" filter chips compress the 4 color tiers: RED+ORANGE = "Needs you" (urgent), YELLOW = "Needs you" (normal), BLUE = "All cases". The mine/shared scope toggle becomes a secondary filter chip pair next to the existing 3. |
| Up Next / Priority Cascade (top N priority tasks) | **R3 Queue header strip** — show the top 3–5 highest-priority RED/ORANGE tasks above the filter chips as "Most urgent". Same shape as the L-4 placeholder we already wired. |
| Active Caseload Bubble (Ch.7 / Ch.13 retained counts + filed counts + Pending Discharge) | **NO HOME — keep reachable via** R3 Queue header KPIs row (compact one-liner above the filter chips), OR utility rail "Home". Decision needed (§8 Q3). |
| Today's Hearings / Filings Footer | **NO HOME — keep reachable via** R3 Queue footer (sticky bottom strip on the Queue view), OR utility rail "Calendar → Today". Decision needed (§8 Q4). |
| Legal Comms / ECF Inbox (ConsolidatedMessagingWidget) | NO HOME — utility rail "Messages". The L-6 placement in the current Legal Dashboard isn't carried into the reference. |
| `buildLegalTasks()` derivation function + all type exports | Preserved verbatim — feeds R3 Queue. The function is pure; only its consumer (the Queue) changes shape. |
| Re-review RED tier (ReReviewChip · evaluateReviewStaleness) | Preserved verbatim — surfaces in R3 Queue as a RED "Needs re-review (ruleset v<X> stale)" pill on the case row. |
| Scope filter (mine / shared) | Preserved verbatim — feeds R3 Queue filter chips (deferred L-9 wiring continues as-is). |

### I · Supporting panels

| Capability | Reference slot |
|------------|----------------|
| ExemptionsLiquidationPanel | R4–R8 · "Exemptions" sidebar entry · R7 Main custom body. |
| MaritalAdjustmentPanel | R4–R8 · "Marital adjustment" sidebar entry · R7 Main custom body. |
| LongFormDeductionPanel | R4–R8 · "Long-form deductions" sidebar entry · R7 Main custom body. |
| ReviewShell (4-tab container) | Becomes R7 Main · tab switcher (Attorney case workspace). |
| ClientPortal-side: ClientDashboard task feed, file timeline, document upload | **R11 ClientPortal** (to-do list w/ active/ready/locked tiers · timeline · safety advisory). Wires to existing client portal data, not the reference's mock. |
| ClientPortal-side: ClientRegistration / GetHelpEntry | Outside the legal portal — already in their own routes (`src/components/get-help/GetHelpEntry.tsx`, `src/ClientRegistration.tsx`). Not affected by this restyle. |

---

## 5 · "NO HOME — keep reachable" — consolidated list

Items that have no slot in the reference's case-review surface and need a home outside R1–R11.

**Proposed solution: utility rail (left-edge icon-only column or top-header menu)** with these entries:

| Entry | Source capability | Role gate |
|-------|-------------------|-----------|
| Home | IntakeDashboard · LeadsByMonthChart · CaseActivityLog · ClientTimeLog | legal_admin · super_admin |
| Leads | Leads table · NewLeadModal · LeadDetail (Info/Contact Log/Intake Summary) · LogContactModal · UpdateIntakeInfoModal · ScheduleConsultModal · LeadClaimBanner · StaffGuidedIntake · Status/Urgency badges · All Lead CRUD actions | legal_admin · super_admin |
| Calendar | ConsultSchedulerPanel · Calendar month/week view · staff availability · time-off blocks · Events color-coded by type | All staff roles |
| Messages | ConsolidatedMessagingWidget · ECF inbox · attorney_intake_reviews threads | All staff roles |
| Tasks | My Tasks / Staff Tasks (non-case tasks only — case tasks already in R3 Queue) | All staff roles |
| My Schedule | Time-off requests · availability self-service · pending approvals | All staff roles |
| Settings → Staff | StaffSettingsPanel CRUD (staff/roles/departments/availability/time-off approvals) | super_admin · department_supervisor |
| Settings → Department | DepartmentSettingsPanel (IRS standards · exemption overrides · AI prompts) | attorney_super_admin · super_admin · department_supervisor |
| Settings → Out-of-Office | SuperAdminSickPanel (sick overrides) | super_admin |
| Manual Clients (V1) | Manual client table + New Client magic-link | legal_admin (V1 only, gated by canCreateClient) |
| Floating Chat | Persists across all views | All staff roles |
| Documents | FileCabinet | All staff roles |
| Time & Fees | placeholder for now; matches current Section type | All staff roles |

**Decision needed (§8 Q5):** confirm utility-rail placement — left-edge icon rail vs. top-header dropdown vs. a "More" tab in R1 next to the 3 role tabs. The reference's R1 design uses a 3-tab pill on the right side of the header; the utility rail could sit on the LEFT of the header as icons-only, preserving the reference's visual.

---

## 6 · Reference items with NO current backing (need to be built or stubbed)

Items in the reference that the current portal has nothing for yet. These can't ship from existing functions; they need to be flagged.

| Reference item | Current portal status | Recommendation |
|----------------|-----------------------|----------------|
| 14-stage Pipeline bar with phases | Partial — file-timeline shell (`src/components/file-timeline/FileTimeline.tsx`) covers lifecycle half + matter-progression stub for 7 of 14. | Map current signals (§3 table above) onto stages we have; STUB the post-petition 6 (`m341_*` / `discharge` / `closed`) until the schema columns land per `schema-changes-for-canelo.md` §1/§10. |
| Exception lane (post-petition issue) | Only via `acceptances.override_required` (not yet built into a UI signal); ECF amendment_flag is DEFERRED. | STUB — show the lane only when `override_required = true`. Wire ECF amendment_flag when schema lands. |
| Client-prep parallel track (Credit counseling + Filing fee) | `client_documents.cc_course_completed_at` exists per schema §7; filing-fee payment row schema unconfirmed. | WIRE credit counseling now (schema §7 lands first); STUB filing-fee until payment-row schema is confirmed with Canelo. |
| R7 FieldMap "Generate filled PDF" (FILL_ENDPOINT) | Not built. | STUB — the button is wired but the endpoint is empty; surfaces "Set FILL_ENDPOINT to your fill service" message (matches reference behavior at lines 509–512). |
| R7 "Best Case ref" tab (Best Case field paths) | Not built. | STUB — show the paths from the reference's FIELD_MAP rows; mark as "representative until the Best Case import dictionary is wired in" (matches reference line 717–719). |
| R9 Scheduling 3-step flow (client offers → attorney picks → client confirms) | Current portal has direct slot-pick + book (ConsultSchedulerPanel + book_consultation RPC); no 3-step offer/pick/confirm cycle. | BUILD — use the existing `findOpenSlotsForDay` / `bookSlot` adapter (`src/lib/intakeScheduling.ts`) for the underlying slot search; the offer/pick/confirm state lives in new tables (DEFERRED schema TODO — flag for Canelo). |
| R10 FinMgmtGate (firm files Form 423 for client) | Schema §7 covers `client_documents.cc_course_completed_at`; Form 423 firm-filing flow not yet built. | STUB — surface the gate as "client completed → firm to file" with a placeholder file-button; wire when the post-petition workflow lands. |
| R11 ClientPortal task feed (active/ready/locked tiers · timeline) | Existing ClientDashboard has a different layout. | REPLACE shape with the reference's; wire to the same existing client_tasks / matter-stage data. Mock data (Maria Delgado · hardcoded steps) must NOT ship. |

---

## 7 · Cross-cutting constraints (carry-overs from user instructions)

These constraints apply to **every** mapping above:

1. **No agent-written SQL migrations.** Anything flagged "DEFERRED — schema TODO" goes to Canelo via `docs/schema-changes-for-canelo.md`. Do not write DDL.
2. **No mock data shipping.** The reference's `CASE` (Maria Delgado), `DOCS`, `FORMS`, `FIELD_MAP`, `SCHED_VALUES`, `CASES`, `AZ_EXEMPTIONS`, `ALL_SLOTS` arrays are all mock. The restyle uses the reference's *visual + IA*, but every panel wires to real existing data via the existing engine / sb-* helpers / RPCs. Panels with no real backing show "not yet wired" empty states, never fake values.
3. **Multi-tenant foundation untouched.** No changes to Firm model, firm_id scoping, RLS policies, role definitions, platform_owner role, or assignment engine.
4. **typecheck cap 254 trending DOWN**, not parked at 254.
5. **Engine reuse, never reimplementation.** Means test, Ch.7 + Ch.13 eligibility, exemptions, cramdown — all go through the existing engine in `src/lib/ch13/`, `src/lib/exemptions/`, `src/lib/meansTest/`, etc.
6. **R7 attorney FieldMap "Approve for signing" is a hard accept gate per schema §6** — acknowledged_issues required, override_required + override_explanation if any critical issue unresolved.
7. **Phase-1 file-timeline shell stays in service** — the reference's Pipeline bar (R2) and the existing FileTimeline.tsx are the same idea; consolidate into one component, do not duplicate.

---

## 8 · Open questions — APPROVED 2026-06-19

> **Status: RESOLVED.** User answers recorded inline below each question. Sub-phase 1 cleared to start once §10 four-zeros audit is on the record (see below).

The original questions and their resolutions:

**Q1 — Role tab compression.** Reference has 3 tabs (Paralegal / Attorney / Client portal). Current portal has 7 roles. Proposed compression in §2: `legal_admin` + `paralegal` both ride the **Paralegal** tab. `legal_admin` gets the utility rail (Leads/Calendar/Messages/Settings) on top, `paralegal` doesn't.
**Confirm?** Or split into 4 tabs (Admin / Paralegal / Attorney / Client)?
> **A1:** Keep **3 role tabs** (Paralegal / Attorney / Client). Route `legal_admin` admin/oversight actions to the **role-gated utility rail** — paralegals must NEVER see admin actions through the Paralegal tab. Permissions stay gated at the rail-icon level and inside each panel; the Paralegal tab UI itself does not expose admin controls. §2 table updated to reflect this.

**Q2 — Stage mapping.** §3 table maps current signals onto 8 of the 14 reference stages today; 6 are stubbed (`m341_docs / m341_submitted / m341_concluded / discharge / closed` + parts of `finmgmt`). Stubs render as "pending" pills with grayed-out text in the Pipeline.
**Confirm Phase-1 ships with these stubs?**
> **A2:** Yes. Stubbed stages render **inactive and clearly labeled** (e.g., grayed-out icon + "not yet wired" tooltip on hover). **No fake data** behind them — empty state only.

**Q3 — Active Caseload Bubble placement.** Currently in LegalDashboard.tsx top-right (L-5). Reference has no slot for it.
**Choose:** (a) R3 Queue header KPIs row · (b) utility rail "Home" · (c) drop in Phase 1, restore later.
> **A3:** (a) **R3 Queue header** — compact KPI row above the filter chips. Pulls from `attorney_case_acceptances` (decision=accepted, by chapter) + `accounting_filed_case_registry`. Pending Discharge stays "—" until the post-petition schema lands.

**Q4 — Today's Hearings/Filings Footer placement.** Currently in LegalDashboard.tsx footer (L-7). Reference has no slot.
**Choose:** (a) R3 Queue sticky footer · (b) utility rail "Calendar → Today" · (c) drop in Phase 1, restore later.
> **A4:** **Keep prominent.** Surfaces in **two places**: (i) R3 Queue sticky footer (the immediate "today" strip staff see when they land), and (ii) utility rail "Home → Today" (when a user navigates away from the queue). **Never dropped, never buried.** Same data source either way (`calendar_events` filtered to firm TZ + today).

**Q5 — Utility rail placement.** Where does the back-office surface (Leads/Calendar/Messages/Settings/etc.) live?
**Choose:** (a) left-edge icon-only rail (Material-style nav rail) · (b) "More" tab in R1 next to the 3 role tabs · (c) top-header dropdown menu · (d) other.
> **A5:** (a) **Left-edge icon-only rail.** Anchored to the viewport left edge, sits OUTSIDE the R1 role-tab pill, visible across all role tabs. Icon-only by default with hover-tooltip labels; role-gated per §5 table.

**Q6 — Drop the Manual Clients V1 tab in the restyle?** It's been a hidden V1 toggle for a while.
**Y / N?**
> **A6:** **N.** Keep Manual Clients reachable in the utility rail (gated by `canCreateClient` as today). Do not drop.

**Q7 — Ch.13 panel placement.** Section D + E above puts the Ch.13 cramdown engine inside the attorney case workspace (R7 Main, custom body, sidebar entry "Ch.13 cramdown"). The current `Ch13SigningReview.tsx` uses a 4-tab ReviewShell. Inside the new R7 there's already a Form-vs-Eligibility/Issues/All-Answers/Decision tab switcher.
**Confirm:** Ch.13 cramdown becomes one *form-equivalent entry in the sidebar* (alongside Schedule D, B 122A, etc.), so it sits flush with the form-mapping flow rather than as a separate tab cluster?
> **A7:** **Confirmed.** Ch.13 cramdown sits as one sidebar entry flush with Schedule D / B 122A / etc. R7 Main renders the Ch.13 panel (Ch13Eligibility) as its custom body when that entry is active.

**Q8 — Build order after Step-0 approval.** Per the user's "propose a sub-phase build plan" instruction: proposed sub-phases below. **Confirm or reorder.**
> **A8:** **6-sub-phase order confirmed.** Critical addendum: **the utility-rail panels (sub-phase 6) carry real production function — they get the same checkpoint rigor as the case-review workspaces (sub-phases 3–5), not a rushed cleanup pass.** Each utility-rail panel-move is its own diff with its own typecheck + vitest gate.

  - **Sub-phase 1 (shell + Pipeline + role tabs + utility rail skeleton):** R1 header + R1 role tabs + R2 Pipeline bar (wired to current signals per §3; 6 stages stubbed) + utility rail icons (no panels behind them yet — clicking takes you to the existing tab so nothing is lost). Phase-1 file-timeline component absorbed into R2.
  - **Sub-phase 2 (Queue):** R3 Queue (Needs you / Waiting on client / All cases · mine/shared scope) wired to `buildLegalTasks()` + `intake_leads` + `attorney_case_acceptances` + `accounting_filed_case_registry`. Drop the existing LegalDashboard widgets; the Queue replaces it for staff landing.
  - **Sub-phase 3 (Paralegal ReviewWorkspace):** R4 Sidebar (paralegal) + R5 ScheduleVerify + R6 DocCard + R8 Footer ("Send to attorney review"). Wires to `paralegal_reviews / doc_confirmations / section_confirmations / client_documents`. ParalegalReview.tsx absorbed.
  - **Sub-phase 4 (Attorney ReviewWorkspace):** R4 Sidebar (attorney "Forms to be filed") + R7 FieldMap (Field mapping / Form preview / Best Case ref tabs) + the Eligibility/Issues/All Answers/Decision tab switcher above R7 + R8 Footer ("Approve for signing" hard accept gate). Absorbs IntakeAttorneyReviewModal + AttorneyAcceptanceModal + SigningReview tab structure + Ch13Eligibility + ExemptionsLiquidationPanel + MaritalAdjustmentPanel + LongFormDeductionPanel.
  - **Sub-phase 5 (Scheduling + FinMgmtGate + ClientPortal):** R9 Scheduling 3-step + R10 FinMgmtGate + R11 ClientPortal. Wires to existing `intakeScheduling` adapter + `client_documents.cc_course_completed_at` + ClientDashboard data. New tables for the 3-step offer/pick/confirm cycle DEFERRED to schema-changes-for-canelo.md.
  - **Sub-phase 6 (Utility rail panels):** Build out the actual panels behind each utility-rail icon (Leads / Calendar / Messages / Tasks / My Schedule / Staff Settings / Department Settings / Out-of-Office / Manual Clients / Home / Documents / Time & Fees). This is the big absorb of LegalAdminPortal's 9881 lines — once the case-review surface (sub-phases 1–5) is locked in. Most of this is *moving* existing components into the rail layout, not rewriting them.

Each sub-phase stops at its own checkpoint with a diff.

---

## 9 · What is NOT in scope of this Step-0

- No code edits.
- No schema changes (schema-doc TODOs from §3 and §6 flagged for Canelo).
- No commits.
- No changes to existing routes or unauth-default views.

After approval of §8, the restyle proceeds sub-phase by sub-phase with a stop-and-diff at each.

---

## 12 · PARKED — Sub-phases 3–6 (resume into D1 shared shell)

Status (2026-06-20): sub-phases 3–6 of this restyle plan are **PARKED** in
favor of the cross-department D1 build (Master Spec v2 + functional readme).
D1 unifies all three department portals on one shared shell with a 220px
labeled sidebar — that shell is the chrome the remaining restyle phases
will build INTO.

Why the pause: rebuilding the case workspace (sub-phase 3 Paralegal R4–R8 /
sub-phase 4 Attorney R4–R8) against the prior 56px icon-rail chrome would
mean redoing the same work after D1 replaces it. Parking now avoids the
double effort.

Resume order — pick up after D1 ships:

| Sub-phase | What | Reads from |
|---|---|---|
| 3 — Paralegal workspace | R4 Sidebar (Schedules + Documents) + R5 ScheduleVerify + R6 DocCard + R8 footer | D1 shared shell |
| 4 — Attorney workspace | R4 Sidebar (Forms to be filed) + R7 FieldMap + R8 footer + Eligibility/Issues/All Answers/Decision tab switcher | D1 shared shell |
| 5 — Scheduling + FinMgmt + Client Portal | R9 3-step Scheduling + R10 FinMgmtGate + R11 ClientPortal | D1 shared shell |
| 6 — Utility-rail panels | Leads / Calendar / Messages / Tasks / My Schedule / Settings / Out-of-Office / Manual Clients / Home / Documents / Time & Fees | D1 shared shell (these are now sidebar entries inside the unified chrome, not a separate rail) |

Sub-phase 6 specifically gets RE-SCOPED by D1 — the "utility rail" concept
becomes the unified 220px sidebar itself. The labeled entries replace the
icons-only rail. So "Utility-rail panels" in sub-phase 6 is now "Sidebar
panels" — same idea, different visual.

No code from this restyle is reverted. The shipped sub-phase 1 (chrome
skeleton) + sub-phase 2 (Queue) work continues to apply; only the rail
visual changes to a labeled sidebar via D1's `Sidebar.tsx`.

---

## 10 · Four-zeros audit — pre-flight for sub-phase 1

Confirmation gate the user required before sub-phase 1 starts. Audit run 2026-06-19 against the §4 mapping table.

### 10.1 — ZERO unmapped functions ✅

Every entry from the §4 inventory has either an R# slot or a "NO HOME — keep reachable via …" with a concrete utility-rail home. Spot-check by file:

- **LegalDepartmentPortal.tsx (340 lines):** PIN-gate login → PRE-SHELL ✓; 6 Section types → mapped to R3/R4–R8/utility rail entries ✓; 9 Promise.all data fetches → preserved verbatim feeding R3/R4 ✓.
- **LegalAdminPortal.tsx (9881 lines):** 11 tabs → all mapped (R3 / utility rail) ✓; 8 modals → 5 to R4–R8 case workspace, 3 to utility rail Leads detail ✓; ~85 button actions → grouped under parent mappings ✓; 14 specialized components → all mapped ✓; 8 computed values → all surface inside R4–R8 ✓; 7 role gates → preserved at rail-icon level + per-action checks (see 10.3) ✓.
- **ParalegalReview.tsx:** 3 tabs + 5 document sections + per-doc card (6 statuses, transferred/duplicated preserved as pills on R6) + per-section summary + 4 data fetches + 6 user actions + role gate → all mapped ✓.
- **SigningReview.tsx:** 5 tabs + 31-item checklist + 4 panels (ExLiq, Marital, LongForm, Ch13) + 4 data fetches + 11 user actions + role gate → all mapped ✓.
- **Ch13Eligibility.tsx:** 11 engine inputs + 7 computed outputs + audit-log + reason-capture → all mapped to R7 Ch.13 panel ✓.
- **Ch13SigningReview.tsx:** ReviewShell 4-tab + 10 derived inputs → all mapped; stub demo data (Camry/Civic) explicitly flagged DROP ✓.
- **AttorneyIntakeDashboard.tsx:** 4 panels (Eligibility/Issues/All Answers/Decision) → mapped to R7 Main tab switcher ✓.
- **LegalDashboard.tsx + legalTasks.ts:** AllTasksWidget + Up Next + Active Caseload Bubble (→ R3 header per A3) + Today's Hearings/Filings (→ R3 sticky footer + utility rail "Home → Today" per A4) + Legal Comms + buildLegalTasks + ReReviewChip + scope filter → all mapped ✓.
- **Supporting panels:** ExLiq, Marital, LongForm, ReviewShell, ClientDashboard, ClientRegistration/GetHelpEntry → all mapped or explicitly out-of-scope ✓.

**Conclusion: ZERO orphan capabilities.**

### 10.2 — ZERO mock-data reads in restyle code paths ✅

The reference (`docs/design/legal-portal-reference.jsx`) contains 9 mock arrays/constants: `CASE` (Maria Delgado), `DOCS`, `FORMS`, `FIELD_MAP`, `SCHED_VALUES`, `CASES`, `AZ_EXEMPTIONS`, `ALL_SLOTS`, `LOCAL_FORMS`. **None of them get imported or read by the restyle code.**

Restyle code paths only borrow from the reference:
- **Design tokens** (the `c` palette: `ink`, `inkSoft`, `paper`, `bg`, `bgWarm`, `teal`, `tealSoft`, `tealLine`, `amber`, `amberSoft`, `amberLine`, `red`, `redSoft`, `slate`, `slateLight`, `line`) — pure color/border constants.
- **`PHASES`** + **`STAGES`** arrays (14 stages, 4 phases, icon assignments) — pure structural metadata, no mock answers.
- **`NEXT_STEP`** map (stage → "next step" label) — pure copy strings.
- **`stageTone()` / `needsAction()` / `initials()`** helpers — pure functions.
- **`Pill` / `Eyebrow` / `NotifyBadge` / `RailRow`** primitives — pure UI components.
- **`Pipeline` / `Queue` / `ReviewWorkspace` / `Scheduling` / `FinMgmtGate` / `ClientPortal`** component shapes — re-implemented against real data.

**Where the reference reads mock arrays (e.g., `FORMS.map(...)`, `SCHED_VALUES[active.id]`, `CASES.map(...)`, `ALL_SLOTS.map(...)`, `LOCAL_FORMS[localKey]`), the restyle reads real data** from: `intake_leads`, `attorney_intake_reviews`, `signing_reviews`, `paralegal_reviews`, `acceptances`, `doc_confirmations`, `section_confirmations`, `client_documents`, `attorney_case_acceptances`, `calendar_events`, `ecf_tasks`, `ecf_inbox`, `accounting_filed_case_registry`, plus the existing `intakeScheduling` adapter (`get_open_slots` / `book_consultation`).

Panels without real backing show "not yet wired" empty states (e.g., R7 FieldMap Best Case ref tab, FILL_ENDPOINT generate-PDF button, 3-step Scheduling tables) — **never fake values**.

**Conclusion: ZERO mock-data dependencies.**

### 10.3 — ZERO role-gate regressions ✅

All current role gates preserved or strengthened:

| Current gate | Restyle posture |
|--------------|-----------------|
| `PIN-gate staff login` (DepartmentPortalLogin) | Preserved as PRE-SHELL wrapper. |
| `canManageLeads` (legal_admin · super_admin) | Gates utility rail "Leads" icon + per-action checks. |
| `canManageStaff` (super_admin · department_supervisor) | Gates utility rail "Settings → Staff" + per-action. |
| `isSuperAdmin` | Gates "Settings → Out-of-Office" + cross-department views. |
| `canCreateClient` | Gates "Manual Clients" rail entry. |
| `attorney_super_admin` / `law_firm_owner` | Gates AI-intake-prompt edits inside Department Settings. |
| `ALLOWED_ROLES` in SigningReview (attorney / legal_admin / firm_super_admin / super_admin_bankruptcy_ai) | Preserved via R1 role tab AND per-action role check inside R7. |
| `attorney`-only Ch.13 reclassification + till-rate override + priority override | Preserved inside Ch13Eligibility — no change. |
| `platform_owner` (super_admin_bankruptcy_ai) | Untouched per CLAUDE.md "Do not touch the multi-tenant foundation". |
| `legal_admin` admin actions NOT visible to `paralegal` | **STRENGTHENED.** §8 A1 explicitly requires gating at BOTH the rail-icon AND inside each panel's actions (defense-in-depth — utility-rail visibility does not replace per-action role checks). |

**No role gate is dropped. No role gate is downgraded. The `legal_admin` ↔ `paralegal` boundary is explicitly tightened.**

**Conclusion: ZERO role-gate regressions.**

### 10.4 — NO new migration required for sub-phase 1 ✅

Sub-phase 1 scope: **R1 header + 3-role-tab pill + left icon utility rail (icons-only, click routes to existing tabs as interim) + R2 Pipeline bar (14 stages, 8 wired, 6 stubbed)**.

Per-surface migration check:

- **R1 header + role tabs:** reads role from `staff_members` / existing auth context. No new column. ✓
- **Left icon utility rail:** click routes to existing `LegalAdminPortal.tsx` tabs via prop-drilled `currentSection` setter. No schema. ✓
- **R2 Pipeline bar:** derives stage from §3 signal table. All 8 wired stages use **existing columns**: `intake_leads.status` / `sent_for_review` / `intake_completed`, `paralegal_reviews.status`, `section_confirmations.status`, `doc_confirmations.status`, `attorney_intake_reviews.decision`, `signing_reviews.status`, `attorney_case_acceptances.decided_at`, `calendar_events.type` / `status`, `accounting_filed_case_registry`, `client_documents.cc_course_completed_at` (schema §7 — assumed landed; if not, sub-phase-1 R2 leaves `finmgmt` stubbed too until it does). **6 stubbed stages render inactive with no DB read.**
- **Phase-1 file-timeline component** (`src/components/file-timeline/FileTimeline.tsx`) **absorbed into R2** — no duplicate component. Existing component remains until sub-phase 2 consolidates; sub-phase 1 introduces the R2 visual without removing the old timeline (zero deletion, zero risk).

**No DDL, no new columns, no new tables, no new RPCs required for sub-phase 1.**

**Conclusion: ZERO migration prerequisites.**

### Summary

All four zeros confirmed. Sub-phase 1 is cleared to start.

---

## 11 · Sub-phase 1 — concrete build scope (locked)

For traceability into the diff. Files touched in sub-phase 1:

- **NEW:** `src/legal-portal/LegalPortalShell.tsx` — outer chrome wrapper (R1 header + R2 Pipeline + left icon utility rail). Tokens from reference.
- **NEW:** `src/legal-portal/RoleTabs.tsx` — Paralegal / Attorney / Client pill.
- **NEW:** `src/legal-portal/UtilityRail.tsx` — left icon column, role-gated entries, interim click → existing-tab routing.
- **NEW:** `src/legal-portal/PipelineBar.tsx` — 14-stage Pipeline bar (8 wired, 6 stubbed-inactive); absorbs the Phase-1 file-timeline visual.
- **NEW:** `src/legal-portal/legalPortalTokens.ts` — design tokens (the `c` palette + mono font const + STAGES + PHASES + NEXT_STEP) extracted from the reference, NO mock data arrays imported.
- **NEW:** `src/lib/pipelineStage.ts` — pure function `derivePipelineStage(caseSignals) → StageKey` per §3 signal table; null for cases where no signal yet (caller renders the queue-default "all cases" view).
- **MODIFIED:** `src/LegalDepartmentPortal.tsx` — wrap the existing section-router body inside `<LegalPortalShell>`. Existing tabs preserved underneath the rail; no behavior change yet.

**Files NOT touched in sub-phase 1:**
- `src/LegalAdminPortal.tsx` — sub-phase 6 territory. Sub-phase 1 only references it via the utility-rail interim routing (existing prop contract).
- `src/components/ParalegalReview.tsx`, `src/components/SigningReview.tsx`, `src/components/AttorneyIntakeDashboard.tsx`, `src/components/Ch13Eligibility.tsx`, `src/components/Ch13SigningReview.tsx` — sub-phases 3, 4 territory.
- Any DB schema / migration files — out of scope per §10.4.
- `App.tsx` routing — sub-phase 1 mounts inside the existing `LegalDepartmentPortal` mount point, not as a new view.

### 11.1 · Interim rail entries — regression fix (post sub-phase 1 build)

**Problem caught at checkpoint:** the old horizontal sub-nav had explicit buttons for *Paralegal Review* and *Signing Review*. Sub-phase 1 removed that sub-nav. The Queue (sub-phase 2) is the design's intended entry point into both surfaces. Until the Queue lands, **the two case-review surfaces are orphaned** — `section` state can hold `paralegal_review` / `signing_review` but no UI control sets them.

**Fix (this commit):** two **temporary** rail entries — `paralegal_review_interim` and `signing_review_interim` — wired as `{ kind: "intra", section }` clicks. Clearly flagged as INTERIM in both `UtilityRail.tsx` (defining-site comment) and `LegalDepartmentPortal.tsx` (`SECTION_TO_RAIL_KEY` comment). The labels include "(interim — opens last-touched case)" to keep users from treating them as permanent fixtures.

**Removal trigger:** sub-phase 2 ships and Queue rows open the case workspace. At that point:
1. Delete the two `*_interim` entries from `DEFAULT_RAIL_ENTRIES` in `UtilityRail.tsx`.
2. Flip the two SECTION_TO_RAIL_KEY values back to `null` in `LegalDepartmentPortal.tsx`.
3. The `section` state continues to hold those values; only the rail entry-points change.

**Why this doesn't violate "design FROM the reference":** the reference layout has no rail entries for Paralegal/Signing Review either — they're case-workspace surfaces reached via Queue row click. The two interim entries are a *temporary bridge*, not a design deviation. They get removed at the exact moment the canonical Queue entry point becomes available.

