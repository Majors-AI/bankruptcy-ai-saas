# Bankruptcy.AI — Questionnaire & Document flow

All files in `schedules/`. Order below is the **client flow order**. Each is a
self-contained React prototype (oxblood/paper design system), data-bound — bind
the data objects/props to real questionnaire data; the samples are preview-only.

Parent epic: **MAJ-128** (per-section answer summary / review).

| # | File | Ticket | What it is |
|---|------|--------|------------|
| 01 | `01_VoluntaryPetition.jsx` | MAJ-129 | Form 101 review — Parts 1–7, auto-calc brackets, chapter-aware funds line. **Chapter is firm-set** (read-only badge, no client 7/13 toggle). Housing asks **rent vs. own**; if rent, asks whether an **eviction (possession) judgment** was entered, then landlord, judgment date, right-to-cure, and 30-day rent deposit. The eviction judgment flows to the SOFA legal-actions question. |
| 02 | `02_ScheduleAB.jsx` | MAJ-130 | Schedule A/B — property by Parts 1–7, subtotals + grand total |
| 03 | `03_ScheduleC.jsx` | MAJ-131 | Schedule C — exemptions + **liquidation worksheet** (net equity → non-exempt → liquidation value) |
| 04 | `04_ScheduleD.jsx` | MAJ-132 | Schedule D — secured (homes/vehicles) + total |
| 05 | `05_ScheduleE.jsx` | MAJ-133 | Schedule E — priority unsecured + total |
| 06 | `06_ScheduleF.jsx` | MAJ-134 | Schedule F — nonpriority unsecured + total |
| 07 | `07_ScheduleG.jsx` | MAJ-135 | Schedule G — contracts & leases (empty-state + structure) |
| 08 | `08_ScheduleH.jsx` | MAJ-136 | Schedule H — codebtors (empty-state + structure) |
| 09 | `09_ScheduleI.jsx` | MAJ-137 | Schedule I — income, monthly lines + combined total |
| 10 | `10_ScheduleJ.jsx` | MAJ-138 | Schedule J — expenses + total + net (pulls income from I) |
| 11 | `11_MeansTest.jsx` | MAJ-140 | Means test (122A-1/122C-1) — income sources, wages vs **self-employment (gross)**, CMI vs non-CMI summary; imports Schedule I |
| 12 | `12_SOFA.jsx` | MAJ-142 | Statement of Financial Affairs (Form 107) in form order; **pre-fills from documents** (income from pay stub + tax returns, refunds, 90-day creditor payments from Schedule D/J, garnishment from pay-stub deductions, **attorney fee** + **credit-counseling payment** from the fee record/certificate, **eviction judgment** from the petition) — confirm + add. **90-day payment import filtered to the date window + dollar threshold** ($600 consumer / $8,575 non-consumer, debt-type toggle). Bankruptcy-advice question reflects the **Disclosure of Compensation** (attorney fee) and the **credit-counseling agency** (provider + amount paid); legal-actions question pre-fills the **eviction judgment**. |
| 13 | `13_FinalReview.jsx` | MAJ-139 | **Overall summary** — full breakdown of every section incl. Means Test, SOFA, **Statement of Intention, Disclosure of Compensation**, and the **Verified Creditor Matrix as the FINAL verification step** (debtor verifies after all documents are complete); confirm-all gate. Comes before the Document Portal. |
| 14 | `14_DocumentPortal.jsx` | MAJ-141 | Document Portal — all docs **by schedule** (+ per-doc schedule ref), currency engine, 60-day unlock, signing-day balances, **credit-counseling 180-day validation** (cert age at filing → valid-through date or Action needed), **signing re-validation** of expiring docs, courses, identity, tax. Each section header is **labeled with the official form** it supports. The credit-counseling upload asks **when the course was taken** and **how much was paid** (flows to SOFA). Uploads/completions + the signed **fee agreement** post to the client file (time log + file cabinet). |

## Staff portal (separate from the client flow)

| # | File | Ticket | What it is |
|---|------|--------|------------|
| 15 | `15_TrusteeDocumentPortal.jsx` | MAJ-143 | **Trustee Document Portal** — staff-facing, 4 tabs. Task List tracks **341 status (Scheduled/Continued/Concluded)**, **post-petition issues / trustee demands**, **pending tasks**, **2004 exams**, add/remove needed docs; automatic + manual reminders (logged). Calendar, Review Queue (review→manual assign). Trustees tab now shows the **full document breakdown from the Document Portal grouped by the statement each was filed under**, individually selectable per trustee (+ submission instructions + merged 341 checklist + API config). **Firm Trustees removed.** |
| 16 | `16_ClientFile.jsx` | MAJ-144 | **Client File (visible)** — the case cockpit, 7 tabs: **Overview** (case-status stage tracker info&docs→signing→filed→341→concluded→discharge→closed + facts/metrics + close actions), **Payments** (invoice + history + record payment), **Documents** (submitted via Document Portal + filed/PACER/fee agreement + Pleadings-to-file templates), **Time log** (auto-logged events; 0.2 hr min then 0.1 hr; billable vs non-billable by role), **Docket (PACER)** (docket entries + creditor claims), **Tasks** (done vs outstanding), **Communications** (full client thread + send email/text, auto-logged). Time log drives the **end-of-representation fee look-back** (§329 reasonableness review: accrued value vs flat fee). **Lives inside the Client File Cabinet (17).** |
| 17 | `17_ClientFileCabinet.jsx` | MAJ-147 | **Client File Cabinet (firm-level)** — roster of every client file with stage/case#/docs/balance/next-action; search + filter; opening a row opens the Client File (16). Includes the on-screen **lifecycle** (intake → retained → portal questionnaire → gather + request docs → signing re-validation → credit-counseling 180-day check). |
| 18 | `18_StatementOfIntention.jsx` | MAJ-148 | **Statement of Intention (Form 108)** — after SOFA. Part 1 pulls **Schedule D** secured creditors with intent (surrender / redeem / reaffirm / retain-explain) + exempt-on-C; Part 2 pulls **Schedule G** personal-property leases with assume / do-not-assume. Summary + sign. |
| 19 | `19_DisclosureOfCompensation.jsx` | MAJ-149 | **Disclosure of Compensation (Form 2030)** — after SOFA; **signed/filed by attorney**. Case-type fee schedule (**Regular 7 / Bifurcated / Ch 13**) → agreed / **paid by client** / balance due; source; sharing; included/excluded services. Fee flows to SOFA + Payments. |
| 20 | `20_CreditorMatrix.jsx` | MAJ-150 | **Verified Creditor Matrix** — all creditors (D/E/F) + co-debtors (H) + Schedule G lease counterparties / interested parties / **former spouse**, including any party with a **different address** (own line). Client may **leave a creditor off** (discharge warning). **Verification is signed at the final review (13)**, after all documents are complete. |
| 21 | `21_FirmIntegrations.jsx` | MAJ-151 | **Firm Setup — Integrations & Calendar Sync (multistate)** — sync **Microsoft 365 / Twilio / SendGrid / PACER** across districts; PACER accounts per district; calendar sync by **public iCal link** or **mailbox sign-in** (system parses court notices, assigns to the case file, calendars 341/deadlines/hearings/discharge); every date routed to the **assigned attorney's task list + calendar portal**. |
| 22 | `22_StatementSSN.jsx` | MAJ-152 | **Statement About Your Social Security Numbers (Form 121)** — filed with the petition, kept **out of the public record**; per debtor: full SSN / ITIN / none, masked to last 4 in review; verified against photo ID at the 341. |
| 23 | `23_ProfitAndLoss.jsx` | MAJ-154 | **Fillable Profit & Loss — by source & month** — lives inside the Document Portal. Monthly income/expenses across **self-employment/business, rental property, and other household/family income** for the means-test lookback (default 6 months); computes per-month net, the period total, and the **monthly average** that feeds the Means Test (Form 122) & Schedule I. Self-employed/rental clients complete this in place of uploading statements. |

## Flow
Schedules 01–10 → **Means Test (11)** → **SOFA (12)** → **Final Review / overall summary (13)** → **Document Portal (14)**.
Staff Trustee Document Portal (15) runs alongside, after filing, for the 341 / trustee-submission workflow.

## Cross-file wiring
- Schedule I (09) income → Schedule J (10) net **and** the Means Test (11).
- Schedule A/B (02) values + Schedule D (04) liens → Schedule C (03) liquidation analysis → Form 101 line 17 + Ch.13 best-interest floor.
- Means Test (11) income summary + Schedules A/B & C accounts → Document Portal (14) required docs.

## Open items (not yet built)
- Fillable **P&L-by-source/month** form + **rental / family-support income** forms (live inside the Document Portal).
- **Data-binding refactor** on files 01–10 (prop-driven, no inline sample) — 11–14 are already prop-driven / de-identified.
- **Scope:** confirm Means Test + Plaid + portal currency are V1 vs V1.5.
