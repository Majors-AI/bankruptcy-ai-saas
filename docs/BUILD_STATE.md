# Build State Map

_Last refreshed: 2026-06-11._

**Legend:** ✅ PRESENT · 🟡 PARTIAL · ❌ ABSENT

---

## Rules layer

### Reference data present

| Dataset | Status | Evidence |
|---|---|---|
| National Standards (food / housekeeping / apparel / personal care / misc, by household size) | ✅ PRESENT | `src/lib/irsMeansStandards.ts:765` — `NATIONAL_STANDARDS_2025` |
| Housing & Utilities — by state × county × household size | 🟡 PARTIAL (AZ + WA loaded; CA + others not) | `src/lib/irsMeansStandards.ts:558` — `IRS_HOUSING_UTILITIES_2025` |
| Transportation — ownership (national 1/2), public transit (national), operating by region/metro | ✅ PRESENT | `src/lib/irsMeansStandards.ts:658` — `IRS_TRANSPORTATION_2025` |
| Transportation — county→region map | 🟡 PARTIAL (metro→state code map in `Ch13Eligibility.tsx`; no canonical county→region table) | `src/components/signing-review/Ch13Eligibility.tsx` (`METRO_TO_STATE_CODE`) |
| Median Income — 50 states + DC + 4 territories × household size + per-person addon | ✅ PRESENT | `src/lib/irsMeansStandards.ts:851` — `MEDIAN_INCOME_BY_STATE` + `MEDIAN_INCOME_META` |
| Means-Test Figures — long-form deduction catalog | ✅ PRESENT (catalog) | `src/lib/meansTestDeductions.ts` (engine) · `src/components/law-firm-settings/MeansTestExpensesPage.tsx` (read-only catalog UI) |
| Exemptions — Federal § 522(d) | ✅ PRESENT | `irsMeansStandards.ts:986` |
| Exemptions — Arizona | ✅ PRESENT (Best Case 2026-02-23 values) | `irsMeansStandards.ts:1020` |
| Exemptions — Washington | ✅ PRESENT (Best Case 2026-02-23 values) | `irsMeansStandards.ts:1060` |
| Exemptions — California (§703 + §704 election) | ✅ PRESENT (CONFIRM flag on rows) | `irsMeansStandards.ts:1117` |
| WA homestead by county (RCW 6.13.030) — 39 counties + $125k floor | ✅ PRESENT (floor enforced) | `irsMeansStandards.ts:1068` (data) · `irsMeansStandards.ts:1198` (`getWaHomesteadCap` with `Math.max(125_000, county)`) |
| CA §704.730 band — per-county clamped median + indexed floor/ceiling | ✅ PRESENT (county map populated, AB-1885 band configured) | `irsMeansStandards.ts:1126` (`homesteadBand` floor 300k / ceiling 600k) · `:1139` (county clamp map) |
| Ch.13 admin multipliers (trustee fee %) — AZ 8.20 / WA-W 10 / WA-E 10 | ✅ PRESENT | `src/lib/ch13PlanCost.ts` — `CH13_ADMIN_MULTIPLIERS` |

### Rule-section metadata (Prompt 35)

| Affordance | Status | Evidence |
|---|---|---|
| Last-updated date per section header | ✅ PRESENT (all 4 firm-side rule pages + Means-Test Figures) | `src/components/law-firm-settings/RuleSectionMeta.tsx` — chip reads max(datasetDate, latest publishEvent) |
| Request-Change button per section | ✅ PRESENT (all 4 + Means-Test Figures; replaces prior stub alert on Exemptions) | `RuleSectionMeta.tsx` (button + modal) · `src/lib/ruleChangeRequests.ts` (in-memory store) |
| Per-case manual override | ✅ PRESENT for Living Standards / Means-Test Figures (via `meansTestOverrides` on Long-Form Deduction Panel); ❌ ABSENT for Median Income, Exemptions, Local Rules at the attorney-case level | `src/components/signing-review/LongFormDeductionPanel.tsx` (override + reason capture) · `src/lib/meansTestOverrides.ts` |

### Admin per-section CSV/PDF upload (Prompt 36)

| Section | Status | Evidence |
|---|---|---|
| All sections (CSV + PDF, with preview + stage-via-audit) | ✅ PRESENT (third sub-panel in `ReferenceRulesTab`) | `src/admin/PerSectionUploadsPanel.tsx` · `src/admin/SectionUploadControl.tsx` |
| Local Rules (per-district PDF upload — pre-existing) | ✅ PRESENT | `src/admin/LocalRulesAdminPanel.tsx` |

### Rules governance — Slice 5 (Prompt 37)

| Affordance | Status | Evidence |
|---|---|---|
| Firm Accept gate on publish (pending until accepted, doesn't auto-apply) | ✅ PRESENT | `src/lib/firmRuleUpdates.ts` · `src/components/firm-rule-updates/FirmRuleUpdateAcceptNotice.tsx` · mounted at `src/LawFirmSettings.tsx:368` |
| About-to-file warning on Signing Review surfaces | ✅ PRESENT | `src/components/firm-rule-updates/PreFilingGateBadge.tsx` · mounted at `src/components/SigningReview.tsx:614` (Ch.7) + `src/components/signing-review/Ch13SigningReview.tsx:278` (Ch.13) |
| Hard pre-filing re-review gate (block when case stamp ≠ firm applied version) | ✅ PRESENT | `firmRuleUpdates.ts` — `evaluatePreFilingGate` |
| Attorney-only clearance via re-review | ✅ PRESENT (UI gate) | `PreFilingGateBadge.tsx` — `isLawyer` gates the "Re-review now" action |

---

## Ch.13 engine

### Libs + test count

| Lib | Status | Tests |
|---|---|---|
| `src/lib/ch13Cramdown.ts` (§ 506(a) bifurcation + § 1325(a) hanging-paragraph) | ✅ PRESENT | 19 tests in `ch13Cramdown.test.ts` |
| `src/lib/tillRate.ts` (WSJ prime + risk premium + amortizeMonthly) | ✅ PRESENT | 7 tests in `tillRate.test.ts` |
| `src/lib/ch13PlanCost.ts` (conduit, trustee fee, monthly payment) | ✅ PRESENT | 16 tests in `ch13PlanCost.test.ts` |
| `src/lib/ch13Commitment.ts` (§ 1325(b)(4) classification + 100% payoff) | ✅ PRESENT | (covered indirectly via Ch13Derive) |
| `src/lib/ch13Derive.ts` (intake-derivation helpers, pure module) | ✅ PRESENT | 24 tests in `ch13Derive.test.ts` |
| `src/lib/firmRuleUpdates.ts` (pre-filing gate) | ✅ PRESENT | 8 tests in `firmRuleUpdates.test.ts` |

**Total Ch.13 lib tests:** 66 (cramdown 19 + till 7 + planCost 16 + derive 24).
**Grand total vitest:** 74 (with firmRuleUpdates 8).

### Batch wiring on Ch13SigningReview

| Input | Status | Source |
|---|---|---|
| **Batch 1** | | |
| `cmiMonthly` | ✅ WIRED | `deriveCmiMonthly(form_data)` via `cmi.ts` (`sumOtherIncomeIncludedInCMI` fallback) |
| `medianAnnual` | ✅ WIRED (null-safe) | `getMedianAnnualIncome(firmPrimaryState, householdSize)` — null surfaces "median unavailable" notice + suppresses plan-cost outputs |
| `planMonths` | ✅ WIRED | `classifyCommitmentPeriod(...).period.months` |
| `venue` | ✅ WIRED | `deriveVenue(firmPrimaryState)` — Arizona→AZ, Washington→WA-W |
| **Batch 2** | | |
| `securedClaims` | ✅ WIRED | `deriveSecuredClaims(form_data)` — primary mortgage + second mortgage + intake.vehicles[].hasLoan |
| **Batch 3** | | |
| `mortgageArrearsInPlan` | ✅ WIRED | `arrears > 0 \|\| mortgageCurrent === "no"` |
| `arrearsCure` | ✅ WIRED | `form_data.mortgageArrears` |
| `ongoingMortgageOverTerm` | ✅ WIRED | `form_data.mortgageMonthlyPayment × planMonths` |
| `priorityClaims` | ✅ WIRED (taxDebt only; broader pool TODO leaf) | `form_data.taxDebt` |
| `bestInterestsFloor` | ✅ WIRED | Ch.7 ExemptionsLiquidationPanel `onTotalsChange` |
| **TODO leaves preserved on individual claims** | | `daysSincePurchase`, `isPersonalUseVehicle`, `isRetained`, junior-lien capture |

### § 1322(b)(2) anti-modification (Nobelman)

| Treatment | Status | Evidence |
|---|---|---|
| Primary-residence mortgage flagged `antiModification: true` | ✅ PRESENT | `deriveSecuredClaims` in `ch13Derive.ts` |
| Excluded from § 506(a) cramdown set + cramdown amortization sum | ✅ PRESENT | `Ch13Eligibility.tsx` — filter on `bifurcations` |
| Rendered with cure-and-maintain treatment (§ 1322(b)(5)) instead of cramdown | ✅ PRESENT | `AntiModificationCard` in `Ch13Eligibility.tsx` |
| Wholly-unsecured junior-lien strip surfaced as attorney-confirmed (not auto-applied) | ✅ PRESENT (note); junior-lien intake capture ❌ ABSENT | Anti-mod section footer in `Ch13Eligibility.tsx` |

---

## Portals

| Portal | Status | Evidence |
|---|---|---|
| Ch.7 Signing Review Portal | ✅ PRESENT (#11) | `src/components/SigningReview.tsx` · `App.tsx:320` nav entry |
| Ch.13 Signing Review Portal | ✅ PRESENT (adjacent #11 entry) | `App.tsx:368` nav entry + route at `:632` |
| Per-case chapter routing (case wins over portal) | ✅ PRESENT | `SigningReview.tsx` — `caseChapter` detect + dispatch; `wrongPortalNotice` |
| Ch.7 Signing Appt. Portal | ✅ PRESENT (#12) | `App.tsx:374` nav entry |
| Ch.13 Signing Appt. Portal | ✅ PRESENT (adjacent #12 entry) | `App.tsx:381` nav entry |
| `Ch13PlanPortal` mount | ✅ PRESENT (under Ch.13 Signing Appt route) | `App.tsx:741` mount |
| `Ch13PlanPortal` non-lawyer sanitized status bar | ✅ PRESENT | `src/components/signing-review/Ch13PlanPortal.tsx` |
| Bankruptcy.AI Admin Portal — #21 numbering | ✅ PRESENT ("21. Bankruptcy.AI Admin") | `App.tsx` nav-item label |
| Operator gate on #21 | ✅ PRESENT (env `VITE_PLATFORM_ROLE` OR `OPERATOR_EMAILS` allowlist) | `App.tsx:114` (`isOperatorEmail`) · `:451` (`hidden: !isSuperAdmin`) |

---

## Admin operator console (`SuperAdminPage`)

| Surface | Status | Evidence |
|---|---|---|
| Dashboard metrics row (Total Firms, Cases on Platform, Cases Filed) | ✅ PRESENT (Prompt 24) | `src/admin/SuperAdminPage.tsx` — `OperatorDashboard` |
| Firm registry (signup date + cases-filed columns + row-click → profile) | ✅ PRESENT (Prompt 24) | `SuperAdminPage.tsx` — `FirmsTab` + `OPERATOR_SEED_FIRMS` merge |
| Firm profile shell (header + trend placeholder + 4 placeholder sections) | ✅ PRESENT (Prompt 24) | `SuperAdminPage.tsx` — `FirmProfileShell` |
| **Slice 2** — View as / Law Firm Settings (read-only support view) | ✅ PRESENT (Prompt 25) | `SuperAdminPage.tsx` — `OperatorViewAs` + `ViewAsSection` |
| **Slice 3** — Comparison | 🟡 PARTIAL — placeholder `ProfileSection` only | `SuperAdminPage.tsx:546` |
| **Slice 4** — Billing — service plan (firm-scoped) | 🟡 PARTIAL — placeholder `ProfileSection` only (existing Usage & Billing tab unchanged) | `SuperAdminPage.tsx:552` |
| **Slice 5** — Update Rules / rules governance | ✅ PRESENT (firm-side accept gate built; cross-firm operator-side push view ❌ not yet) | `firmRuleUpdates.ts` etc. |

---

## Other

### Performance Goals (Prompt 34)

| Surface | Status | Evidence |
|---|---|---|
| Targets surface — Law Firm Settings → Performance Goals | ✅ PRESENT | `src/components/law-firm-settings/PerformanceGoalsPage.tsx` |
| Per-employee monthly targets store (in-memory + localStorage) | ✅ PRESENT | `src/lib/perfGoalsStore.ts` |
| Super-admin vs dept-supervisor gating (with scope-preview selector) | ✅ PRESENT | `PerformanceGoalsPage.tsx` — `canSetGoalsForEmployee` |
| Intake dashboard Performance/Goals card populated (NOW / GOAL / NEEDED) | ✅ PRESENT | `src/components/intake-dashboard/IntakeDashboard.tsx` — `GoalMetricRow` |
| Footer: graceful empty-state when no target set | ✅ PRESENT | `IntakeDashboard.tsx` — `GoalsFooterNote` |
| Actuals aggregation (real lead/case events) | 🟡 PARTIAL — seed data today; TODO leaves name each metric's source query | `perfGoalsStore.ts` — `ACTUALS_SEED` |

### MLG admitted states (firm `…0001`)

| Item | Status | Evidence |
|---|---|---|
| MLG seeded with both Arizona AND Washington | ❌ ABSENT — default is `["Arizona"]` only | `src/lib/firmPolicy.ts:316` — `_firmAdmittedStates` defaults to `[_firmPrimaryState]` (which is `"Arizona"`). Washington must be hand-checked in Firm Policy → Practice Jurisdictions. |
| `OPERATOR_SEED_FIRMS` carries admitted-states field | ❌ ABSENT — seed has `id`, `name`, `slug`, `status`, `signupDate`, `casesOnPlatform`, `casesFiled` but no admitted-states | `src/admin/operatorSeed.ts:31` (MLG record) |

### Operating Expenses figures display (Living Standards → Transportation)

| Item | Status | Evidence |
|---|---|---|
| Top-line dollar stats (ownership 1/2 car, public transit national) | ✅ PRESENT | `src/components/law-firm-settings/LivingStandardsPage.tsx:480` (`Stat` rows with `$${...}`) |
| Per-region operating dollars in summary line (`Regional one $X · two $Y`) | ✅ PRESENT | `LivingStandardsPage.tsx:501` |
| Per-metro `one` / `two` operating dollar columns | ✅ PRESENT (admitted-states filtered) | `LivingStandardsPage.tsx` (metros table inside each region details) |

---

## Footer

```
npm run typecheck   →  256 errors  (full unfiltered)
npx vitest run      →   74 tests passing across 5 files
```

**Test files:**
- `src/lib/ch13Cramdown.test.ts`        — 19 tests
- `src/lib/tillRate.test.ts`             —  7 tests
- `src/lib/ch13PlanCost.test.ts`        — 16 tests
- `src/lib/ch13Derive.test.ts`          — 24 tests
- `src/lib/firmRuleUpdates.test.ts`     —  8 tests

**Notable items not yet on disk** (carried through TODO leaves):
- Real per-case `stampedVersionId` threading from `AttorneyReviewRecord` into `PreFilingGateBadge` on SigningReview hosts (both pass `null` today).
- Real lead/case event aggregation for Performance Goals actuals (seed data today).
- Junior-lien-on-principal-residence capture in intake (gates the strip-eligibility determination).
- Operator-side cross-firm "Update Rules" push view (Slice 5 firm-receive side built; operator overview ❌ not yet).
- USTP housing PDF parser hooks (CSV ingestion done; PDF attach-only today).
- Pre-existing `XCircle` unused-import in `SuperAdminPage.tsx:29` (carried-forward typecheck warning).
