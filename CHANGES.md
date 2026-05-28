# Foundation Branch — `feature/foundation-rebrand-upl`

Branched from `feature/maj-61-intake-portal-funding` at `82c1b6c` (the audit-bundle commit).

## Commits in this PR

```
c2e44aa chore: lint fix from foundation work
0416848 feat: UPL script library with 7 seeded scripts (BAN-36)
490bba0 feat: role-based access + firms + user_profiles + super-admin stub (BAN-35, BAN-40)
c5a9927 feat: rebrand majorslaw.ai → bankruptcy.ai platform-wide (BAN-39)
31bfd96 fix: SSN field shows last-4 from intake, full SSN required in portal (BAN-27 Blocker 3)
d2f7e1e fix: portal prefill normalizer handles all intake shapes (BAN-27 Blocker 2)
a6856be fix: Step 3 Continue unblocked for single filers (BAN-27 Blocker 1)
```

`git diff --stat 82c1b6c..HEAD`: **26 files changed, 614 insertions(+), 57 deletions(-)**.

## What's in this PR

- **BAN-27 Blocker 1** — Step 3 Continue unblocked for single filers. `canProceed` step 2 now gates on `data.filingType` (the user-controlled field) instead of `data.maritalStatus` (which was derived but never written). A `useEffect` in `StepHousehold` keeps `data.maritalStatus` in sync with the derived value so downstream code (LegalAdminPortal, submission payload) still sees it.
- **BAN-27 Blocker 2** — Portal prefill normalizer (`src/lib/intakeNormalize.ts`). Coalesces the three intake shapes (old JSONB blob nested, old direct camelCase, new snake_case columns) into a single camelCase view. Applied in `mapIntakeToRetention` (questionnaire `.jsx`) and `buildPreFill` (`FullBankruptcyQuestionnaire.tsx`). `BankruptcyQuestionnaire.tsx` left alone — confirmed orphan via grep (no imports anywhere in `src/`); see BAN-28 for the dedup plan.
- **BAN-27 Blocker 3** — SSN last-4 labeling. `mapIntakeToRetention` now sets `petition.ssnLastFour` (separate from `petition.ssn`) when the intake provided only the last 4 digits, so the portal does not prefill a 4-digit value into the full-SSN input. `SectionVoluntaryPetition` shows an amber helper line: "Last 4 from intake: ***-**-XXXX. Please complete your full SSN below."
- **BAN-39** — `bankruptcy.ai` rebrand. UI text replaced in components and edge-function email/SMS templates. Mock `firm:` fields and the mock attorney "From:" email now use real MLG identifiers (`"Majors Law Group"`, `@majorslawgroup.com`). `noreply@majorslaw.ai` → `noreply@bankruptcy.ai` (assumes DNS will follow). `package.json` name → `bankruptcy-ai-saas`. Migrations left alone (applied seed data with `MajorsLaw` IOLTA account names and `@majorslaw.ai` seed staff emails — modifying applied migrations would create drift). `MAJ-61_inventory.md` and `refresh-audit-bundle.md` left alone (audit docs frozen in time). `.bolt/prompt` left alone (Bolt template config). Verified clean with `grep -ri "majorslaw" src/ public/ index.html package.json | grep -v majorslawgroup.com | grep -v majorslawgroup-intake` → 0 matches.
- **BAN-35** — Role-based access helpers (`src/lib/auth.ts`). Exports `PlatformRole` matching the new Postgres enum, type guards (`isAttorney`, `isFirmStaff`, `isBankruptcyAISuperAdmin`), capability checks (`canAcceptCase`, `canQuoteFee`, `canSetPaymentPlan`, `canRequestClarification`), and a transition mapper `mapIntakePortalRoleToPlatformRole` that translates the existing `staff_members.intake_portal_role` values to `PlatformRole`. `CaseAcceptanceFlow` now takes an optional `currentUserRole` prop and gates the "Send Fee Agreement via BoldSign" button — non-authorized users see "Pending Attorney Approval" with a `console.log` placeholder. `LegalAdminPortal` passes `mapIntakePortalRoleToPlatformRole(session.role)` when launching the flow.
- **BAN-40** — `firms` + `user_profiles` tables, super-admin stub. Migration `20260527020000_firms_and_user_profiles.sql` creates `firms` (multi-tenant root with status enum `lead/trial/active/suspended/churned`), seeds Majors Law Group as the first firm (id `00000000-0000-0000-0000-000000000001`), creates the `platform_role` Postgres enum (matching `PlatformRole`), and creates `user_profiles` linking `auth.users` → `firms` with a platform role and optional `staff_member_id` back-reference. RLS enabled with permissive SELECT for anon (tighten in follow-up). New `src/admin/SuperAdminPage.tsx` is the bankruptcy.ai platform-level super-admin stub (distinct from the firm-level `SuperAdminPortal.tsx`). Wired into `App.tsx` as view `bankruptcy_ai_admin` and a nav entry. Currently always denies access (no auth context yet) — gating is in place ready for BAN-40 phase 2.
- **BAN-36** — Script library. Migration `20260527030000_script_library.sql` creates `script_library` with a unique partial index on `(script_key) WHERE is_active=true` (single canonical version per key). Seeded 7 UPL-safe scripts:
  - `intake_bot_opening`
  - `intake_staff_verification_opening`
  - `post_acceptance_legal_admin`
  - `attorney_clarification_request`
  - `liaison_agent_opening`
  - `bot_legal_question_deflect`
  - `mid_case_attorney_followup`

  `src/lib/scriptLibrary.ts` exports `getScript(scriptKey, variables)` with `{placeholder}` interpolation. `IntakeChatbot` welcome message is now sourced via `getScript('intake_bot_opening', { firm_name: 'Majors Law Group' })` with the legacy hardcoded line preserved as a fallback. TODOs noted for (a) threading `firmName` from firm context once BAN-40 lands, and (b) updating the `intake-ai-chat` edge-function system prompt under BAN-34 (separate PR).

## What's NOT in this PR (separate work)

- Three duplicate portal questionnaires (`BankruptcyQuestionnaire.tsx` orphan dedup) — **BAN-28**.
- IRS National Standards wired to Schedule J.
- Schedule G lease-term field for month-to-month exclusion.
- SOFA gaps: setoffs / gifts / charity questions.
- Form 108 (Statement of Intention) questions.
- PI Screening section in `ClientIntakeForm.tsx` (the questionnaire pre-Phase 1 had Section 8 — Personal Injury Screening; destination form does not).
- Credit-pull consent collection inside intake.
- Plaid live integration — **BAN-31** (blocked on **BAN-44** Plaid agreement clearance).
- iSoftpull live integration — **BAN-31** (blocked on **BAN-47** iSoftpull terms approval).
- Billing engine — **BAN-42** (blocked on **BAN-51** outside-counsel review).
- `intake-ai-chat` edge-function system prompt UPL review — **BAN-34** (separate PR; this PR only updates the client-visible welcome line before the LLM is involved).
- Tightening RLS policies on `firms` / `user_profiles` (currently permissive SELECT for anon — fine for bootstrap, tighten once auth flow lands).
- Real Supabase auth integration + `currentUserRole` lookup from `user_profiles`. The `SuperAdminPage` route + `CaseAcceptanceFlow` `currentUserRole` prop are in place; full enforcement awaits BAN-40 phase 2.

## Pre-existing issues observed (not addressed in this PR)

- `npm run lint` reports 293 errors / 14 warnings total against the codebase; almost all are pre-existing (unused imports, `any` types, `react-hooks/exhaustive-deps` warnings, `_`-prefixed unused params). This PR introduced **zero net new lint errors** after the `c2e44aa` fix.
- `npx tsc --noEmit -p tsconfig.app.json` reports ~40 errors, all in files this PR did not substantially modify (`LegalAdminPortal.tsx`, `LegalDocumentPortal.tsx`, `MessagePortal.tsx`, `ParalegalReview.tsx`, `StaffCommHub.tsx`, `TrusteeDocumentPortal.tsx`). No new tsc errors from this PR's changes.
- No test runner configured (`npm test` returns "no test specified") — verification was lint + tsc + `vite build`.
- `npm run build` succeeds (5.15s; main bundle 3.9 MB, gzip 920 kB). Pre-existing Browserslist warning (`caniuse-lite is outdated`).
- The `clients` and `case_acceptances` tables created in MAJ-61 Phase 6 (`20260527010000`, `20260527010100`) reference `intake_leads(id)` — that FK relationship is now live and underlies the role-gated CaseAcceptanceFlow handoff.

## How to test

1. **Step 3 Continue (Blocker 1):** Open the intake form, choose Individual filing, complete Step 1 and Step 2 (Identity). On Step 3 (Household) the Continue button should now be enabled even without manually selecting a marital status — `data.maritalStatus` is auto-derived from `data.filingType`.
2. **Portal prefill (Blocker 2):** Submit a new intake from `ClientIntakeForm.tsx` (writes snake_case columns). Open the portal questionnaire → identity / address / household fields should populate. Also verify with a legacy `BankruptcyIntake.jsx` submission (camelCase) and any old `form_data` JSONB blob submission — all three shapes should prefill.
3. **SSN labeling (Blocker 3):** After completing intake (which only collects last-4), open the portal Voluntary Petition section. An amber helper line should read "Last 4 from intake: ***-**-XXXX. Please complete your full SSN below." The full-SSN input is empty, not prefilled.
4. **Rebrand (BAN-39):**
   ```
   grep -ri "majorslaw" src/ public/ index.html package.json \
     | grep -v majorslawgroup.com \
     | grep -v majorslawgroup-intake
   ```
   should return 0 matches.
5. **Role gating (BAN-35):** Log in to LegalAdminPortal as a non-attorney role (legal_admin or intake) and walk a lead through to the "welcome_call_pending" step in CaseAcceptanceFlow. The "Send Fee Agreement via BoldSign" button should be replaced with "Pending Attorney Approval" (no DB write fires; a `console.log` message is emitted on click).
6. **Super-admin stub (BAN-40):** From the nav, click "bankruptcy.ai Admin". The page should render an "Access Denied" view ("Required role: super_admin_bankruptcy_ai · Current role: unauthenticated") because `currentUserRole={undefined}` is passed by `App.tsx` until auth lands.
7. **Script library (BAN-36):**
   ```
   SELECT count(*) FROM script_library WHERE is_active = true;
   ```
   should return `7`.

   ```
   SELECT script_key FROM script_library WHERE is_active = true ORDER BY script_key;
   ```
   should list: `attorney_clarification_request`, `bot_legal_question_deflect`, `intake_bot_opening`, `intake_staff_verification_opening`, `liaison_agent_opening`, `mid_case_attorney_followup`, `post_acceptance_legal_admin`.

   Open the IntakeChatbot (client side, not admin) → first welcome message should be the `intake_bot_opening` script with `{firm_name}` substituted to "Majors Law Group". If the script_library lookup fails for any reason, the legacy hardcoded greeting is the fallback (no broken UI).
