# Section Summary Review Screens — Integration Notes

Eleven read-only **answer-summary** components, one per bankruptcy section, plus a
consolidated **Final Review**. Restyled to the bankruptcy.ai dark theme (navy
`#0d1221` cards, `amber-400` accent, slate borders, serif headings). Built from
Dom's reference mocks; content/structure preserved, colors swapped.

## ⚠️ The one rule: these are PROP-DRIVEN — do not ship the example data

Every file carries an `EXAMPLE_*` default (clearly commented `EXAMPLE ONLY — do not
ship`). Those exist so the component renders standalone for preview. **Your job at
merge is to pass each component the real client's answers via its props** — pulled
from the questionnaire state / Supabase. Never let an `EXAMPLE_*` default reach a
real client; it contains placeholder financial data.

## Prop contracts

| File | Component | Props |
|------|-----------|-------|
| 01_VoluntaryPetition | `VoluntaryPetitionReview` | `data` (petition answers object), `chapter` |
| 02_ScheduleAB | `ScheduleABReview` | `parts` (Parts 1–7, each `{n,title,assets[]}`), `debtor` |
| 03_ScheduleC | `ScheduleCReview` | `assets[]`, `domicile`, `debtor` |
| 04_ScheduleD | `ScheduleDReview` | `secured[]` (each `{name,kind,collateral,value,balance,lien}`), `debtor` |
| 05_ScheduleE | `ScheduleEReview` | `priority[]`, `debtor` |
| 06_ScheduleF | `ScheduleFReview` | `unsecured[]`, `debtor` |
| 07_ScheduleG | `ScheduleGReview` | `contracts[]` (`[]` when none), `debtor` |
| 08_ScheduleH | `ScheduleHReview` | `codebtors[]` (`[]` when none), `debtor` |
| 09_ScheduleI | `ScheduleIReview` | `employment`, `incomeLines[]`, `debtor` |
| 10_ScheduleJ | `ScheduleJReview` | `household`, `monthlyIncome`, `expenseLines[]` (`amount:null` = not captured), `debtor` |
| 11_FinalReview | `FinalReview` | `data` (all sections), `debtor`, `onSubmit` callback |

Exact field shapes are documented in the comment block at the top of each file.

## Where they slot in

- **Per-section summaries (01–10):** render at the end of each matching left-nav
  section, as the review step before the client advances to the next page. They are
  display-only recaps (Schedule C also lets the client tick each equity figure).
- **Final Review (11):** the consolidated confirm-everything screen. Each schedule
  has a confirm checkbox; the submit button stays disabled until all are confirmed,
  then fires `onSubmit` to advance to Signing Review. This is where the hard gate
  lives.

## Derived calculations

The components compute their own subtotals, brackets, liquidation analysis, and
I−J net from the data you pass. Feed them the raw entered values — don't pre-compute.
Schedule C's non-exempt equity (value − liens − exemption) drives the liquidation
number, which Final Review rolls up.

## Open decisions (confirm with Dom before final wiring)

1. **Per-section gating.** As designed, sections 01–10 only *display*; the hard
   confirm-gate is at Final Review. If Dom wants a confirm-to-advance on every
   section, that's an added behavior, not in these files.
2. **Scope.** These cover the Petition + Schedules A/B–J + Final Review. They do
   **not** cover the four SOFA sections, the Means Test, or Document Upload — those
   left-nav steps have no summary until Dom specs them.
3. **Tokens / fonts.** Theme matched from the app's observed palette. If the exact
   slate shades or heading font differ from the app's design system, align the CSS
   vars at the top of each component's `Style()` block. Self-contained `<style>` was
   kept (uniform across all 11, clean to drop in); convert to Tailwind if preferred.

## Branch

This is a **new feature** — branch off fresh `main`, separate from the layout branch
(`maj-layout-responsive-fix`). Its own PR for Dom.
