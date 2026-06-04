# Client Suite — Data Flow & Document-Currency Rules

Build the app to follow this lifecycle. Every step writes to the client's file (time log) automatically.

## Where things live
- **Client File Cabinet** (`17_ClientFileCabinet.jsx`) is the **firm-level home** for every client file. It is a roster of all clients; opening a row opens that client's **Client File** (`16_ClientFile.jsx`).
- The **Client File** is the system of record for one case (Overview · Payments · Documents · Time log · Docket/PACER · Tasks · Communications).

## Lifecycle (data flow)
1. **Client intake form** — a lead completes intake (intake / lead-gen bot). Data is captured at the intake stage.
2. **Retained** — when the client signs the fee agreement, **a Client File is created in the Client File Cabinet** and the intake data **flows into the file**. (No re-keying.)
3. **Client Portal questionnaire** — the client supplements the **full questionnaire** in the portal: Schedules A/B–J (`01–10`), Means Test (`11`), SOFA (`12`).
4. **Gather + request** — when the questionnaire is complete, the system **gathers any remaining info/details**, then **requests the client's documents** via the Document Portal (`14`), organized by the schedule each supports.
5. **Signing scheduled → re-validate** — when a signing is scheduled, the file is **re-validated**: any documents that may have **expired or gone stale** are re-checked and re-requested, specifically:
   - Photo **ID** still valid at filing.
   - **Income docs & bank statements** current for the filing month (monthly refresh).
   - **Credit-counseling 180-day window** (see below).
   - **Bank balances as of the filing date** are gathered — one per **non-exempt** account (day-of-signing balance; fully-exempt retirement accounts skip unless their last statement is >90 days old at filing).
6. **Filing** — on filing, the **case number** is captured from the PACER Notice of Bankruptcy Case Filing and written to the file; docket + claims sync to the PACER tab.

## Document-currency rules (enforce in the Document Portal)
- **Filing-date currency:** every filing document must be current **as of the filing date**.
- **Monthly refresh:** income documents and bank statements must cover **6 months through the current month**; when a new month begins before filing, that month is re-requested.
- **Signing-day balances:** an updated balance is required for **every account that is not 100% exempt**, as of the signing/filing day (one per account). An automated email goes out the morning of signing.
- **Exempt accounts:** fully-exempt retirement accounts skip the balance refresh **unless** the last statement is **>90 days old** at filing.
- **Credit counseling (11 U.S.C. § 109(h)):** the **pre-filing credit-counseling certificate must be obtained within 180 days (~6 months) before the actual filing date.** The portal computes the certificate's age at the anticipated filing date:
  - Valid → shows the **expiry date** (completion + 180 days) and the days of margin; if the filing slips past that date, the course must be **retaken**.
  - Older than 180 days at filing → flagged **Action needed**: must be retaken before filing.

## Post-SOFA filing documents (in order, after SOFA)
After the SOFA, the signing/filing package adds:
- **Statement of Intention — Form 108** (`18`): secured creditors pulled from **Schedule D** with the intent for each (surrender / redeem / reaffirm / retain-explain) + exempt-on-Schedule-C; personal-property leases pulled from **Schedule G** with assume / do-not-assume.
- **Disclosure of Compensation — Form 2030** (`19`): signed and filed by the **attorney**; discloses the fee **agreed / paid by client / balance due**, source, sharing, included/excluded services.
- **Verified Creditor Matrix** (`20`): every noticing address from Schedules D/E/F (creditors), H (co-debtors), and G (lease counterparties, interested parties, spouses such as a **former spouse**), including any party with a **different address** (own line). Client may **leave a creditor off** (with a discharge warning). Ends with the debtor-signed Verification.

## Case-type fee model
The client's fee record is set at intake / legacy import / after attorney review and carries the **case type**:
- **Regular Chapter 7** — flat fee, paid in full pre-petition.
- **Bifurcated Chapter 7** — minimal pre-petition; balance financed under a separate post-petition agreement.
- **Chapter 13** — "no-look" fee; balance paid through the plan.
This single fee record **flows automatically** to: the **Disclosure of Compensation** (agreed/paid/balance), the **SOFA** ("payments to anyone consulted about bankruptcy"), and the Client File **Payments** tab. Set it once; do not re-key.


- The document catalog appears in both the Document Portal (`14`) and the Trustee Portal (`15`) — wire both to **one shared source** to avoid drift.
- Real integrations behind the UI: **PACER** (docket/claims/case number), **messaging provider** (Communications + reminders), **payment processor** (Payments).
- Files `01–10` still need the prop-driven / de-identified refactor (`11–17` already are).

## Final review & creditor-matrix verification
The **Verified Creditor Matrix** is built after SOFA (`20`), but the debtor's **verification/signature is captured at the full Final Review** (`13`) — the FINAL step, only after every document (schedules, Means Test, SOFA, Statement of Intention, Disclosure of Compensation) is complete.

## Billing = end-of-representation fee look-back
The Client File time log is not for invoicing flat-fee work — it drives the **fee look-back** when representation ends: a reasonableness review (11 U.S.C. § 329 / Rule 2017) comparing accrued billable value (by role rate) against the flat fee charged. The Time-log tab shows billable value vs fee.

## Firm setup & calendar sync (multistate) — `21`
One firm setup syncs the channels that receive court notices and client comms across every district: **Microsoft 365, Twilio, SendGrid, and PACER/ECF** (PACER accounts per district). Firms get **secondary notices**; the system reconciles duplicates so a date is calendared once. Calendaring runs two ways (either or both):
- **Public iCal link** — paste a court/calendar webcal/ICS link to subscribe.
- **Mailbox sign-in** — connect the email accounts that receive notices; the system parses each notice, **assigns it to the matching case file**, and **calendars the key dates** (341, objection/claims deadlines, hearings, discharge).
Every important date is pushed to the **assigned attorney's task list and calendar portal**, and to the case file.
