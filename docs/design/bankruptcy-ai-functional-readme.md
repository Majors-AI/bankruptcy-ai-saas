# Bankruptcy.AI — Functional README

**Purpose.** UI + functionality definition for the firm-facing system, written so the build agent can generate the functions from it. **UI-first.** Back-end is deferred: wire each function to a clear data interface (a typed service/hook), and where real data isn't connected yet render an **honest empty / loading state — never fabricated numbers.** Canelo owns schema, RLS, views, and migrations; this README does not specify them.

**Detailed behavior** lives in the companion specs — `department-system-spec` (canonical), `bk-betty-spec`, `post-acceptance-workflow-spec` (welcome-call gate superseded), and the ECF section below. This README is the function index tying them together.

**Cross-cutting rules.** Never edit the locked questionnaire file. Firm-scoped / multi-tenant everywhere. Provider-agnostic integrations (phone, e-sign, email = swappable adapters). UPL guardrails: Betty never gives legal advice; the legal-question classifier is conservative (uncertain → attorney).

---

## 1. Shared Department Shell
One parameterized shell for Intake / Legal / Accounting (do NOT restyle Accounting). Legal + Client share the case-review/client-file layout; Intake uses the same layout, task-based, surfacing priority tasks.
- Render department portal from a `department` param (intake | legal | accounting).
- Persistent left nav + top menu across all pages in the department.
- Role + department-scoped gating.
- Cross-portal toggle (attorneys / dual-assigned only); "Legal Department" ⇄ "Case Review" links.
- Universal search bar (see §12) in every dashboard.

## 2. Access Control & Client Scope
- Intake = potential clients only; Legal = retained only; Accounting = its own.
- Dual-assigned staff see each dept's clients only within that dept.
- Accounting walled off from Legal/Intake (regular staff + attorneys) — EXCEPT the payment view (§15). Super admin MAY access accounting; accounting staff + law_firm_owner too.
- Toggle Intake↔Legal limited to staff assigned to both (usually attorneys).
- Task override allowed only for admin / supervisor.

## 3. Attorney Case Review (the bankruptcy.AI page)
- 3 KPI tiles: Attorney Reviews Needed / Cases to Present / Completed (honest sources; add "Unread Tasks" only when a real per-attorney task count exists).
- Submission list (search, Pending/Accepted/Declined filter).
- Per-case detail tabs: Overview / Eligibility / Issues / All Answers / Decision & fees.
- Eligibility: rough pre-document calc from gross + net; "(gross − net)" labeled **Payroll deductions** with a **Rough / preliminary** chip; admin-consult source → "Insufficient data — net not captured" (never "$0"). Authoritative means test stays in Signing Review.
- Client Docs panel: **request ANY document type** from a defined list (paystubs, bank statements, tax returns, ID, P&L, etc.) + "Other/custom" — not a blank request.
- Accept / decline decision; on accept → routes into the retention flow (§10).

## 4. Intake Portal (task-based)
- Same shell/layout, task-oriented.
- "Next to call" priority surface: (1) clients ready to present, (2) new leads needing scheduling.
- Lead follow-up: manual or AI follow-up bot.
- "New Client Lead" action retained; intake clutter (Escalate to Supervisor, Existing Client Leads, Ask for help, Performance & Goals) removed from top row — **Performance & Goals moves to the left sidebar.**
- Leads stat tiles + Leads-by-Month chart appear ONLY on the Leads page.

## 5. Client Portal
- Shares the case-review/client-file layout (read-appropriate subset).
- Shows where the client is in the process (stage), documents requested/uploaded, messages.
- Betty chat entry point (§6).
- Fee-agreement signing surface (§10).

## 6. BK Betty
- Available to all users.
- Drives the questionnaire conversationally (§7): full Information & Document Questionnaire for full intake; **intake-form-section subset only** for intake.
- Every question mandatory, no blanks, can't submit incomplete; confirm-all-before-submit.
- Gathers client-estimated amounts (stored as estimated / pending-verification); captures employer/source NAMES to drive doc requests.
- **Logs every client question** during the questionnaire individually → attorney addresses at review; client gets a response to each.
- Answers only GENERAL questions, from attorney-approved closed-source content; **never legal advice / conclusions / applying law to facts**; labeled "general information, not legal advice."
- Never modifies the locked questionnaire; rides the shared engine.

## 7. Questionnaire Engine (shared)
- Single source: the locked questionnaire file + the seed question set (personalInfo, Sched A/B, D, E, F, G, H, I, J, means test, SOFA, statement of intention, document checklist).
- yes/no-gated reveals; repeat/add-rows; excludedFromCMI handling.
- Attorney review reads the SAME answers (All Answers tab) — no separate question set.
- Full vs intake-subset scoping.

## 8. Message Triage & Routing
- Inbound from any channel (email / SMS / client portal / firm chat) — channels open, provider-agnostic.
- Binary classify: legal question or not.
  - Not legal → reassign to supervisor (if not attorney-only). Track transfer metrics.
  - Legal → attorney; legal questions added to intake, addressed at attorney review; each handled individually.
  - Accounting → accounting staff. Post-filing (non-legal) → paralegals → escalate to attorney if unanswerable.
- Attorney assigned when a signing appointment is scheduled; before that, legal items fan to all attorneys.

## 9. Call List & Scheduling
- Any department schedules calls within itself.
- Each call assignable to department / specific staff / team / group (Ch.13, escalated-call), with member exclusions.
- Welcome call is one call_type here (post-retention, §10) — not a standalone concept.
- Group membership managed in Department Settings (supervisor / super-admin).

## 10. Retention & Fee-Agreement Flow (replaces welcome-call gate)
- Attorney reviews → if ready to present → back on priority call-back list.
- Send fee agreement with terms (provider-agnostic e-sign).
- Client signs → retained.
- On retention: legal admin attempts to conference the attorney immediately; if not → welcome-call task on the attorney's priority call-back calendar (non-blocking).
- Retention pushes client to Legal: accounting collects, legal starts work per agreement.
- Payment capture: tokenized via the merchant gateway (store token, never raw PAN).

## 11. Task Pool & Assignment
- Unassigned tasks → shared pool; next-available assigned.
- Scheduled-exemption: staff exempt from new pool tasks only while a client commitment is in progress/imminent (configurable window, default ~30 min around it) — not all-day.
- Per-employee filtering/limits by specialization / complexity / case type, configured in Department Settings (supervisor / super-admin).
- Each department's task list lives in Department Settings; delegate task/case types to attorneys/paralegals there.

## 12. Universal Search & Cross-Department Transfer
- Firm-scoped search for any person who contacted the firm.
- Outside-scope results show only name + contact + "Transfer to [dept]" — no record details.
- Transfer: warm transfer (transfer OR conference; notifies other end; no confirm = denied) OR create a task (fallback). Provider-agnostic telephony.
- Legal↔Intake routing: non-retained at Legal → Intake; retained at Intake → Legal.

## 13. Metrics, Activity & Reporting
- Per-department + per-employee metrics: task type, average time, calls handled, retentions, drafting, filings (attorney), transfers.
- Track each employee's daily activity (in-app task attribution; NO keystroke logging, NO screen capture).
- Idle 15 min → "I am active" prompt; no response 60 s → auto sign-out (stay clocked in); show clocked-in-but-signed-out; prompt employee to pick what they were doing (Client call / Court / Meeting / Break / Other+note).
- Reporting tab: completed tasks + billable time. Access tiers: every staff member sees their OWN productivity report; department supervisors see their own department's staff only; super admins see all departments. Billable-time export = super-admin tier.
- One-time TOS/monitoring acceptance modal at first login (employment-law sign-off — not auto-drafted here).

## 14. ECF Monitoring & Automation
- Monitor designated ECF mailboxes: one email per court per firm; attorneys can add mailboxes. Provider-agnostic email (Graph/Outlook = one adapter).
- Read + classify each incoming ECF notice → calendar dated events + create tasks + trigger client comms. Tasks/comms land in the department system.
- Notice mapping:
  - **Notice of 341 (Meeting of Creditors):** calendar the 341; create trustee-document tasks; remind client to attend.
  - **Financial Management Course not taken:** auto-remind client to complete it ASAP (failure = no discharge).
  - **Notice of Discharge:** "great news" email to client.
  - **Case Closure / Final Decree:** mark closed; request firm review from client; task accounting to close the client file.
- **Critical-accuracy guardrail:** deadline-driven dates (341 date, course deadline) are malpractice-sensitive — the parser DRAFTS the calendar entry/task/reminder, but those dates are **surfaced for staff verification** before relied on, never blindly auto-trusted. Retain the source email for audit. Log every auto-action.
- Reuse the existing ECF Closure Bot + 341 reminder bot + Graph email reading; don't rebuild.

## 15. Payment View & BK Forms
- On the legal client file, by the client name show: amount paid (if third party paid, name them); date paid in full; **filing fee paid? yes/no**; client's stage in the process.
- Read-only; sourced from accounting via a derived view; Legal cannot mutate.
- Feeds Disclosure of Compensation (Form 2030) and SOFA (incl. payment dates).

## 16. Integrations (provider-agnostic)
- Phone, e-sign, and email behind neutral adapter interfaces. BoldSign / Twilio / Graph = concrete adapters, swappable. No hard vendor coupling.

## 17. UPL Guardrails (cross-cutting)
- Conservative legal-question classifier (uncertain → attorney); log confidence.
- Betty: closed-source attorney-approved content only; publish requires attorney approval; never legal advice.
- No automated component gives legal advice or determines eligibility (the eligibility screen is preliminary/rough, clearly labeled; authoritative means test is document-derived).
