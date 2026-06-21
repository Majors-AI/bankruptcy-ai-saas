# Bankruptcy.AI — Developer README

This is the canonical "how the system should work" document. It supersedes scattered specs by pulling them into one place; it does not remove anything. If you're new, read sections 1–6 first, then the lifecycle (10) and your area.

---

## 1. What Bankruptcy.AI is

A **multi-tenant SaaS platform for bankruptcy law firms.** One deployment serves many firms; each firm's data is isolated. A firm runs its entire bankruptcy practice through it — intake of potential clients, retention, document collection, schedule preparation, attorney review, signing, e-filing, and post-filing work through discharge and case closure.

The product is built for the staff who do this work every day, so the guiding goal in every design decision is: **make the system as easy as possible on everyone using it** — clients, intake, paralegals, attorneys, accounting, supervisors, and owners.

---

## 2. Stack & architecture

- **Frontend:** Vite + React 18 + TypeScript + Tailwind. Single dark editorial theme (see §4).
- **Backend:** Supabase (Postgres + Auth + RLS). Deployed on Netlify. Branch `6.19.26`.
- **The matter spine:** `intake_leads.id` is the single identifier (`lead_id`) that threads through the entire system. A potential client starts as an `intake_leads` row; that same id follows them through retention, legal work, signing, and filing. When you wire anything to a matter, you wire it to `lead_id`.
- **Multi-tenancy:** every row carries a `firm_id`. Isolation is enforced by Postgres RLS (`firm_id = current_firm_id()`), not by the frontend. The frontend's scope filters are UX convenience; **the real wall is always RLS.**

---

## 3. The locked questionnaire

`src/bankruptcy-information-and-document-questionnaire(1).jsx` is the shared questionnaire engine that drives intake, the client portal, and Betty's data-gathering. It is **locked** — it is never modified by an automated agent, and changes to it are made deliberately and reviewed by hand. Everything else reads from it; nothing rewrites it casually.

---

## 4. First principles (non-negotiable)

These hold everywhere. When in doubt, follow these over convenience.

1. **Honest states, never fabricated data.** Every data hook returns a tagged status (`unwired | loading | empty | ready`). The UI branches on status. When something isn't connected yet it shows "Not yet connected" or "—", never `$0`, never a placeholder name, never an invented count. A number on screen is always real.
2. **Single dark surface.** The whole app is one dark editorial theme. There is no light/dark toggle (it was considered and deliberately skipped — a toggle reintroduces a two-theme maintenance burden). New UI matches the existing dark palette.
3. **No agent SQL.** Schema and data changes go to the backend owner (Canelo) via `docs/schema-changes-for-canelo.md`. The frontend ships against typed interfaces with honest states; the backend view/RLS lands later and the implementation swaps in without UI changes.
4. **UPL guardrails are sacred** (see §7, §15). Non-lawyers never give legal advice; anything that looks like legal advice routes to an attorney.
5. **Universal time-logging** (see §9). Every action on a file, in any department, writes a time-log entry.
6. **Malpractice-sensitive data is staff-verified, never auto-trusted.** Parsed court deadlines, Plaid-derived balances, cross-reference results — the system surfaces them and a human confirms. The system assists; it does not file on its own judgment.
7. **Each change is a small, reviewable slice** with its own commit, recon before code on anything substantial, and a real in-browser check before commit (passing automated gates ≠ "it looks/works right").

---

## 5. Roles & access hierarchy

### The role enum (`PlatformRole`, `src/lib/auth.ts`)
`super_admin_bankruptcy_ai | firm_super_admin | law_firm_owner | attorney | legal_admin | paralegal | intake | accounting | client`

A naming note that trips people up: the view `legal_admin` mounts the **Intake** portal; `legal_dept_portal` mounts the **Legal Department** portal. So the `legal_admin` role is an *Intake staffer*, not a Legal-department admin.

### The hierarchy
**Law Firm Owner ⊃ Super Admin ⊃ Attorney ⊃ Department Supervisor ⊃ regular staff.**

- **Law Firm Owner** — the top. The Owner Portal (Portal #20) shows the **deepest metrics across all departments, including revenue and financial reporting that Super Admins do not see.** Owner-only toggles (e.g., "grant features to Super Admin") default OFF.
- **Super Admin** (`firm_super_admin` / `super_admin_bankruptcy_ai`) — access to **everything except the Law Firm Owner portal**. Manages firm settings, feature toggles, staff and roles, and may access the Accounting portal (the one cross-department exception — see the accounting wall).
- **Department Supervisor** — sees and manages **their own department's settings** and their own department's staff metrics. All departments are structurally identical, so a supervisor's surface is the same shape regardless of department.
- **Regular staff** (paralegal, intake, accounting, regular attorney) — work their own department only. No admin bypass, no firm Settings, no cross-department visibility.

### Who can be assigned what
Law Firm Settings can assign the **Super Admin, the Law Firm Owner, and Supervisors.** Staff can be assigned to **departments and to tasks.** A staffer's department determines their home portal and their wall.

### Custom titles & delegation
Firms may define their **own titles** (HR/directory labels) on top of the platform roles, so a firm's org chart can use whatever names it likes without changing the underlying role logic. Firms can also **delegate the Super Admin and Supervisor roles** to staff they choose — the access tier is assignable, not bound to one fixed person. (The Law Firm Owner remains the top of the hierarchy.)

### Per-firm feature toggles
Each firm controls which features are **on or off for itself**, in Law Firm Settings (Portal #19), gated to the super-admin/owner tier. Examples: **outbound client emails** (a firm that doesn't want automated emails can disable them — the ECF flow in §14 then sends none, though the internal attorney task still fires), **BK Betty** (a firm can choose not to use her), and **requesting additional or other features.** Feature-flagged code must honor a firm's toggles — never send or surface something a firm has switched off.

### Firm-wide updates feed
The law-firm admin side carries a **system-updates feed** where the firm and the Bankruptcy.AI team post **updates, improvements, and announcements** that **all staff** can see — so everyone stays informed as the platform and the firm's processes evolve.

### Portal walls (`src/lib/portalAccess.ts`)
Single source of truth for which portals a role can reach. Regular roles are walled to one department; attorneys keep cross-portal freedom (Case Review + Intake + Legal) but are blocked from Accounting; super-admin tier sees all department portals. Portal-agnostic admin surfaces (firm Settings, platform admin, Productivity) default to **super-admin tier only** — regular staff never see them. Trying to navigate to a blocked portal redirects to the user's home portal with a "restricted" notice.

### The accounting wall (`src/lib/accountingWall.ts`)
The Accounting portal is reachable only by: the `accounting` role, `firm_super_admin`, `super_admin_bankruptcy_ai`, `law_firm_owner`, and an ops allowlist. Legal/Intake staff and regular attorneys are blocked — they get fee/payment visibility through the read-only **payment view on the client file** (§13 schema, `PaymentDataStrip`), not the Accounting portal.

### Reporting tiers (`src/lib/reportingAccess.ts`)
- `self` — every staffer sees their **own** productivity report. (Default for all regular roles.)
- `department` — supervisors see their **own department's** staff.
- `all` — super admins see **all departments.**
- The **Owner** sees all of the above plus the deeper financial/revenue metrics Super Admins do not.
- Billable-time export is super-admin tier.

---

## 6. Departments & the shared structure

There are three working departments — **Intake, Legal, Accounting** — plus the attorney **Case Review** surface. They all share one parameterized shell (220px labeled dark sidebar, header with role context, optional pipeline bar). Accounting keeps a bespoke internal layout but lives behind the same wall logic.

Critically, **every department operates on the same structure:**

> Departments have **tasks**. Staff are **assigned** to a department and to tasks. The system **auto-assigns** tasks from a shared pool based on staff schedules and constraints.

Build to this shared model rather than special-casing each department. Intake's "leads to call" and Legal's "cases needing review" and Accounting's "collections to chase" are all instances of the same task-pool pattern.

### Department settings & email templates
Each department has its own **settings**, which include **email templates** for client communications and the ECF flows (§14). Department settings — templates included — are editable only by **super admins, department supervisors, or the law firm owner.** Regular staff can't edit them, but **any staffer can ask Betty if an adjustment is needed** (§7); Betty makes the change or escalates it.

---

## 7. BK Betty (the assistant) and the attorney pool

Betty is available to **everyone**: potential clients, retained clients, and staff.

- **For clients** (potential and retained): Betty helps them move through the system — **scheduling, completing intake, and sending follow-up requests**, gathering questionnaire answers, explaining what's next, and prompting for documents. Clients can **email documents to a dedicated document address**, and Betty **organizes and labels** them onto the matter; she **sends status updates when the client asks.** In the Legal department she helps clients **gather the information** their schedules need. She uses the locked questionnaire engine — a subset for potential clients, the full flow for retained.
- **For staff:** Betty is a **search tool** — staff ask her any question and she answers from the firm's data, or analyzes what's already on file for a matter ("here's what this client has provided; here's what's missing").

**The UPL line is the hard rule.** Betty gathers and organizes; she never gives legal advice. The classifier is deliberately conservative — when a question is uncertain, it is treated as legal.

**Legal-advice escalation:** when any question (from a client *or* staff) requires legal advice, Betty does not answer it. She **creates a task in the attorney pool** so a licensed attorney addresses it and responds. Betty logs the question against the matter so the attorney has context. This is the same mechanism whether the asker is a client or a non-lawyer staffer.

**Non-lawyer staff cannot handle any lawyer task** — answering legal questions or providing advice. Those tasks are pool-limited to attorneys (see §8 constraints), and Betty's escalation feeds that same attorney pool.

Betty is the highest-UPL-risk surface in the system, so she's built last among the major features, with adversarial testing, approve-before-publish on any content, and audit logging. Her content is closed-source and attorney-approved.

### Betty as a no-code configuration tool (super-admin)
Beyond assisting clients and staff, Betty is how a **Super Admin adjusts the system without code.** A super admin can use Betty to **add or remove notice/task types** — for example the ECF notice→action mappings in §14 — and Betty writes the change to the **database configuration**, no deployment needed. This keeps the system tunable during testing and as firms request adjustments.

The boundary is firm: Betty changes **data/configuration only.** If a request needs a **structural application change** (new schema, a new code path, a capability that doesn't exist yet), Betty does not attempt it — she **notifies the Bankruptcy.AI team that the change is needed** and stops. Guardrails on this power: super-admin only for the *write*; scoped to the super-admin's **own firm**; limited to the **config tables** (never schema, roles, RLS, or another firm's data); every change **audit-logged**; and confirmed before write.

**Any staffer can ask Betty whether an adjustment is needed** — raising the request isn't gated, only the write is. When an adjustment is made, the Bankruptcy.AI admin **prompts the resulting tasks** and **sends a follow-up email summarizing what was addressed**, with **law firm owners, super admins, and department supervisors copied** so leadership sees every configuration change. This is the feedback loop that makes testing and iteration fast.

---

## 8. The task pool & auto-assignment

This is the engine that makes the system "easy on everyone." The goal: **each department shares a pool of tasks, and the system auto-assigns them based on schedule — unless a task is limited to specific employees.**

### The shared pool
By default, tasks for a department go into that department's shared pool and the system assigns the next one to the next available, eligible staffer based on their schedule and current load.

### Constraints (why a task may be limited)
Not every staffer can take every task. The pool must respect:

- **Chapter / skill:** not all paralegals do Chapter 13s; not all attorneys do Chapter 13s. A Ch.13 task only flows to staff qualified for Ch.13.
- **Cross-function:** not all attorneys do intake. An intake-attorney task only flows to attorneys who do intake.
- **Jurisdiction / licensure:** some attorneys are not licensed in certain jurisdictions. A matter in a given state/venue only flows to attorneys licensed there.
- **Explicit assignment:** a task can be limited to a named employee or a defined group (e.g., the Ch.13 team, the escalation group), with member exclusions.
- **Lawyer vs. non-lawyer:** legal tasks (advice, legal questions, attorney review) are pool-limited to attorneys. Non-lawyers are structurally ineligible for them.

So the assignment logic is: *eligible staff for this task* (passing chapter, function, jurisdiction, lawyer/non-lawyer, and explicit-assignment filters) ∩ *available now per schedule* → assign to the best-fit next person.

### Scheduling
Assignment is schedule-aware. Staff have availability windows; a "scheduled-exemption" keeps someone off the auto-assign pool around their appointments (a window around the appointment, not their whole day). Per-employee filtering and load limits are configured in Department Settings by a supervisor or super-admin; overrides are admin/supervisor only.

### SLA
Unresponded items escalate: roughly **1 hour → the task goes to the department group's pool and the next-available staffer picks it up.** Client callbacks are immediate, with a 24-hour maximum.

### Queue fairness & manual override
Clients who **complete intake first enter the queue first** — so a client who has submitted isn't left at the mercy of one particular staffer's availability; the pool keeps things moving. Two manual overrides sit on top of auto-assign:
- A department can **assign or withhold** specific task types from specific staff or attorneys based on what they actually handle (the constraints above).
- If a **client asks to work with a specific staff member**, the department can pull that client out of auto-assign and **hand them to that member** — or route them to staff who generally handle that case type (e.g. the Ch.13 specialists).

---

## 9. Universal time-logging

**Every time a file is reviewed or worked on, in any department, the system writes a TIME LOG entry.** This is automatic and comprehensive, not a manual timer.

- Every staff action against a matter auto-logs to that client's TIME LOG with a description.
- **When a client submits something, that is entered as a time entry, with a description** of what was submitted.
- On retention, the lead's info and its logs transfer to the client record **unchanged** — one continuous history.
- The client sees status only, not the internal logs. Individual messages can be toggled client-visible.

The time log is the spine of the productivity metrics (§11) and the billable-time export.

---

## 10. The matter lifecycle

The full journey a matter takes, and the portals it passes through:

1. **Intake.** A potential client comes in (New Client Intake Form / lead-gen). They land in the Intake portal's pool as an `intake_leads` row. Intake staff (and Betty) gather information and documents.
2. **Attorney review.** A completed intake goes to the attorney pool for review. The attorney reviews eligibility, issues, and all answers, and decides (accept / decline). The review includes a **threshold-amount field** — the minimum the client must have paid before the case can proceed to scheduling/filing (this is the gate amount for bifurcated cases, §12). Accepted cases become "ready to present."
3. **Retention.** (Replaces the old welcome-call gate.) The attorney's accepted cases land on a priority call-back list. The firm presents options, sends the fee agreement, the client signs and is retained. A legal admin conferences the attorney in immediately if possible; otherwise a welcome-call task is scheduled on the attorney's call-back calendar (non-blocking). Retention pushes the client into the **Legal** department; **Accounting** begins collecting; Legal begins the work.
4. **Document collection & schedule prep.** The Legal department, with the client (via client portal + Betty), assembles the schedules from the questionnaire and required documents.
5. **Signing review & final approval** (§12) — an attorney or paralegal reviews the petition and schedules document-by-document; on completion the case exports to BestCase and the reviewer confirms the means test, liquidation analysis, and DMI on Schedule J are clean. This is the final step before approval to schedule the signing appointment, which is gated on a verified credit-counseling certificate (with completion date) and the CFF paid — or, for a bifurcated case, all docs + credit counseling + the attorney-set threshold amount paid.
6. **Signing appointment** — reviewed petition + schedules signed with the client. **Plaid verification** runs here (§12).
7. **E-filing** — the case is filed.
8. **Post-filing / ECF monitoring** (§14) — court notices (341 meeting, financial-management course reminders, discharge, case closure) are monitored and turned into calendar events, tasks, and client communications.
9. **Discharge & case closure** — the case is closed, the file requested for firm review, and accounting closes out.

---

## 11. Metrics, productivity & reporting

Each department has **per-employee metrics: who is doing what, and how many tasks they've handled.** The point is to see **who is most productive.** Metrics are derived from the universal time log and task completions.

Tiered visibility (matches §5 reporting tiers):

- **Every staffer** sees their own report.
- **Department supervisors** see their own department's per-employee metrics.
- **Super admins** see all departments' metrics.
- **The Law Firm Owner** sees everything above **plus deeper metrics — revenue and financial reporting — that Super Admins do not see.** This is the bright line between the Super Admin surface and the Owner portal.

### Per-department metrics
Metrics are **per user, per department**, counting tasks completed, with department-specific definitions:
- **Intake:** leads taken, leads retained, no-answers, no-case outcomes, and the Ch.7-vs-Ch.13 split.
- **Legal:** total reviews, total signings, total filings, total cancellations, etc.
- **Accounting:** its own productivity metrics — but the **Law Firm Owner can restrict** who sees them (accounting metrics touch revenue/financials, so visibility is owner-controlled).

### Idle, lateness & goal tracking
Beyond task counts, the system reports on **staff idle time**, flags when staff are **late**, and surfaces when **goals are not being met.** These feed the supervisor and owner views and follow the same no-surveillance rules below — derived from activity and schedule, never from keystrokes or screen capture. (Lateness needs each staffer's scheduled hours defined; goal-tracking needs targets set — both live in department/staff settings.)

Activity rules (no surveillance overreach): idle >15 min triggers an "I'm active" prompt; no response in ~60s signs the user out (they stay clocked in) and shows a "clocked-in but signed out" state, then prompts them to pick a reason (client call / court / meeting / break / other). **No keystroke logging, no screen capture.**

---

## 12. Signing review & Plaid verification

### How Schedules I & J and the means test are gathered (intake)
Clients do **not** type in their income, deductions, or expense numbers — those entries are almost always wrong. Instead:

- **Schedule I (current monthly income):** the client only **verifies income by indicating the source** (employer, self-employment, benefits, etc.). Indicating a source **triggers the document list** requesting the supporting docs for it (paystubs, 6-month P&L, SSA award letter). The figures come from those documents at review, not from the client's typing.
- **The means test (6-month look-back)** asks for **all income received in the last 6 months**, which can **differ from the Schedule I current-monthly figure.** Because clients often assume they already gave this when they did Schedule I, the system **explicitly clarifies the difference** so they don't skip it.
- **Schedule J (expenses):** the client **cannot enter their own amounts.** The system **uses the IRS living standard** for each category. If the client actually pays **more** than the standard, they mark **"I pay more"** and **provide an explanation for attorney review** — never a free-form number. At attorney review, an over-standard line is exactly what gets scrutinized, with the explanation right there.

### Signing review (same UX for Ch.7 and Ch.13)
Reviewer is an attorney or paralegal. The review flows **like the official forms, document by document, linearly**, with every field able to carry a **note that travels to the signing appointment.** Each field shows a **preview of the client's answer alongside where that answer is entered on the official form** — so the reviewer always sees both the source answer and its placement on the petition/schedule. Order: Voluntary Petition (ID / SSN / credit counseling) → Schedule A/B (property + required docs, carries into C) → Schedule C (net = value − liens; exemption suggested per asset, confirmed per asset; a "preview secured-debt balances" button before confirming) → Schedule D (secured) → Schedule E (priority; taxes/alimony require doc uploads) → Schedule F (unsecured) → Schedule I (income, with **proof required for every source** — paystubs, 6-month P&L, SSA award) → Schedule J (expenses ≤ standards; questioned lines get notes; mortgage + car statements verified and **≤60 days old**) → SOFA. Unexempt equity surfaced during review becomes a note for the signing appointment. Ch.7 carries a Statement of Intention; Ch.13 carries the Plan. Betty assists staff here within the UPL line (suggests what to ask the client, analyzes what's on file) but never makes the legal call — the attorney/paralegal confirms each item.

### Final approval: BestCase export & the scheduling gate
When the signing review is complete, the case **exports to BestCase** (the existing `.BCB` export pipeline). The attorney or paralegal then **imports the file and confirms there are no issues with the means test, the liquidation analysis, and the DMI (disposable monthly income) on Schedule J.** This is the **final step before approval to schedule the signing appointment.**

Approval to schedule is gated on:
- a **verified credit-counseling certificate, with its completion date confirmed**, and
- the **court filing fee (CFF) paid.**

**Bifurcated cases differ.** The CFF is typically rolled into the firm's fees rather than paid separately, so the gate is **all documents + credit counseling + the attorney-set threshold amount having been paid** (not a standalone CFF). The threshold amount is set by the attorney during intake review (§10 step 2) — the minimum paid amount required before the case can proceed.

### Plaid verification at signing
On the day of signing, the system can **pull the client's Plaid documents for verification.** It then **cross-references** what Plaid returns against the schedules and the documents on file and flags:

- **A missing employer** — an income source on Plaid not reflected in Schedule I / employment docs.
- **A missing bank statement** — an account on Plaid without a corresponding statement on file.
- **A newly discovered source** — any income or account that appeared in Plaid but isn't in the matter.

Because this feeds filed legal documents, the cross-reference is **malpractice-sensitive: the system surfaces discrepancies, and a human verifies and resolves them.** It does not silently amend schedules. Plaid/financial data is privacy- and PCI-sensitive — handle tokens, never raw account data, and gate access appropriately.

---

## 13. The payment view (Legal-side, read-only)

The Legal client file shows, next to the client name: amount paid, third-party payer name (if any), paid-in-full date, filing-fee Y/N, and process stage. This comes from a **read-only derived view** (`v_legal_client_payments`, schema §13) — the controlled exception to the accounting wall — consumed by `PaymentDataStrip` through a typed, status-tagged hook. It also feeds the Disclosure of Compensation (Form 2030) and SOFA payment fields. Until the backend view ships, the strip shows honest "Not yet connected" pills.

---

## 14. ECF monitoring & automation

The system monitors designated ECF mailboxes (per court, per firm; attorneys add courts) and classifies incoming notices into actions: a **Notice of 341** creates a calendar event + trustee-document tasks + a client reminder; a missing **financial-management course** prompts a client reminder; a **Discharge** triggers a "great news" client email; a **Case Closure** closes the matter, requests a firm review, and tasks accounting to close the file. **Parsed deadline dates are staff-verified, never auto-trusted** (malpractice-sensitive). Reuses the existing ECF closure bot, 341 reminder bot, and the email connector.

### Recognizing & classifying ECF emails
The system recognizes incoming ECF emails and routes each by type into one of three lanes. The classification is **extensible** — new types can be added to either lane, each with a **custom client message** — and the whole mapping is **Betty-configurable by a super admin** (§7).

**Attorney-first** (the attorney sees it before the client hears anything). On recognition: (1) an immediate **generic client email** — *our office will be in touch if there is anything that needs to be done* (no legal direction on its own); (2) an **attorney "notify client" task**, after which the attorney sends a **notice-specific follow-up** with the real instructions. Types: **Motion to Dismiss, Notice of Hearing, Notice of 2004 Exam, Motion to Confirm, Presumption of Abuse.** Example follow-ups — *missed hearing:* "You did not appear at your hearing; if you do not appear, your case will be dismissed"; *no FMC:* "You will not receive your discharge until the financial-management course is completed — here are the instructions." Betty may draft the follow-up, but an **attorney approves before it sends** (UPL gate). Time-critical items (e.g. a Motion to Dismiss) carry a **higher task priority** so they don't sit in the pool.

**Automatic informative emails** (sent to the client automatically, explaining what the notice is — procedural, no attorney gate). Types: **Completed 341, Proof of Claim filed, Report of No Distribution, Discharge, Case Closed.**

**General notice** (a general informational note to the client). Types: **Notice of Conversion.**

Unrecognized notices are **not dropped** — they land in a human-triage queue. Deadline dates remain **staff-verified, never auto-trusted.**

---

## 15. UPL & compliance guardrails (summary)

- Non-lawyers never give legal advice; the classifier defaults conservative; uncertain → attorney.
- Legal-advice questions (client or staff) → attorney-pool task → attorney responds (§7).
- Betty is attorney-approved, closed-source content; built last, adversarially tested, audit-logged.
- Paralegals disclose they are not attorneys (the signing-review "read aloud to client" opening disclosure).
- Plaid cross-reference and ECF deadlines are surfaced for human verification, never auto-filed.
- Payment card data is tokenized (PCI); raw account/financial data is never stored in the clear.

---

## 16. Integrations (provider-agnostic)

Phone, e-signature, and email are behind **swappable adapters**, not hard dependencies — a specific vendor can be replaced without touching feature code. Plaid is the bank/income verification adapter (§12). **BestCase** is the bankruptcy-petition export sink (the existing `.BCB` export pipeline — field map + writer); the means-test / liquidation / DMI confirmation happens after the attorney/paralegal imports the exported file (§12). E-signature is provider-agnostic (Dropbox Sign favored for the build phase). Treat every external service as a pluggable sink behind a typed interface.

**BestCase strategy.** Today BestCase export is a **complement** — Bankruptcy.AI runs alongside firms that still rely on BestCase, which lowers the barrier to adopting it. The roadmap goal is for Bankruptcy.AI to **take over petition assembly and filing end-to-end** and retire the BestCase dependency over time.

---

## 17. Module / portal inventory (preserved)

The function-level inventory, kept intact. Modules: (1) shared department shell; (2) access control & client scope; (3) attorney Case Review; (4) Intake (task-based); (5) client portal; (6) BK Betty; (7) questionnaire engine; (8) message triage; (9) call list; (10) retention flow; (11) task pool; (12) search + transfer; (13) metrics / activity / reporting; (14) ECF monitoring; (15) payment view + BK forms (Form 2030, SOFA); (16) provider-agnostic integrations; (17) UPL guardrails.

The firm-facing portal lifecycle (the tab strip): New Client Intake Form · Intake Portal · Accounting Portal · Legacy Import · Client Portal · Legal Department Portal · Creditor Verification Portal · File Cabinet · Ch.7/Ch.13 Signing Review · Ch.7/Ch.13 Signing Appointment · E-Filing · ECF Notices · AI Bots · Law Firm Calendar · 341/Trustee Documents · Staff Training · **Portal #19 Law Firm Settings** (firm settings, feature toggles, staff + roles; hosts Productivity) · **Portal #20 Law Firm Owner Portal** (inherits #19 plus owner-only accounting/revenue reporting, productivity reporting, and "grant features to Super Admin" toggles defaulting OFF).

---

## 18. Developer workflow & conventions

- **UI-first against typed interfaces.** Build the UI and the typed hook/service with honest states; defer the Supabase wiring to the backend owner. The implementation swaps in later without UI changes.
- **Slices.** Ship one small, reviewable slice at a time, each with its own commit. For anything substantial, do **recon first** (grep the real code, report what exists, show the plan) before writing code.
- **Gates.** After every change: `npm run typecheck` (hold the baseline error count — a bump means you introduced something, e.g. a non-exhaustive switch, and you fix it properly rather than suppress), `npx vitest run` (keep green), `npm run build` (green).
- **Verify in the browser before committing.** Passing gates do not prove it renders or behaves correctly — visual and access-control checks need real eyes (or, for pure logic like the access walls, a unit test).
- **Schema handoff.** Schema/data changes are specced into `docs/schema-changes-for-canelo.md` for the backend owner; the frontend never runs SQL. Watch enum-ordering dependencies (e.g., a Postgres enum value must be added before a row that uses it is inserted).
- **The locked questionnaire is never auto-edited.**

---

## 19. Current status (as of this writing)

- **Done:** D1 department-system foundation (unified dark shell, accounting wall, payment strip, typed interfaces); single-theme dark unification across all portals; the single-department role walls (`portalAccess.ts`) plus three regular test roles (paralegal / legal_admin / accounting) walled to one department each, pending a Canelo seed.
- **Next:** clock-in/out + communication parity on the Legal Department portal; then **D2** (call list + retention flow rebuild). Later phases: search + transfer, integration adapters, Betty + message triage (last, highest UPL risk), task pool + SLA + telephony, and the full metrics/reporting surface.
- **Parked:** the document-by-document signing review build (sub-phases 3–4), Plaid verification wiring, specific-document request UI, and a few Intake UI cleanups.

---

*This README is the source of truth for how the system should behave. When a spec elsewhere conflicts with it, this wins; when you extend the system, extend this.*
