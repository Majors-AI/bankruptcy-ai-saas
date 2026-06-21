# BK Betty — AI Intake Chat (Change 2: AI live-chat mode)

## What Betty is
BK Betty is the conversational front end for client intake — the **AI live-chat** mode of Change 2's three intake modes (self-serve form / tokenized email interview / AI chat), all running over **one shared questionnaire engine**. She appears at the intake "Chat now" entry (GetHelpEntry) and inside the signed-in client portal. She introduces herself, walks the client through the bankruptcy info + questionnaire conversationally, gathers everything, and pushes it through to attorney review.

**Greeting:** "Hi, I'm BK Betty. I can help you gather your information so an attorney can review your case for eligibility." Then she moves into the questions. Tone: warm, plain-language, patient, non-pressuring — clients are often in financial distress.

## Hard rules

1. **One shared engine.** Betty drives the SAME questionnaire as the form and email modes — same questions, same field definitions. Do NOT build a parallel question set inside Betty. Do NOT modify the locked questionnaire file (`src/bankruptcy-information-and-document-questionnaire(1).jsx`); Betty reads and drives its field surface.

2. **Yes/no for the client.** Every question is yes/no first; on "yes," capture the structured detail. The household-goods section is left untouched (contents unknowable).

3. **Income & amounts — collect client estimates, but the means test stays document-derived.** Betty DOES ask the client for these, as approximate / client-stated figures for the attorney's initial review:
   - Approximate GROSS per pay period.
   - Approximate NET per pay period.
   - How often they are paid (pay frequency).
   - Monthly expense amounts.
   - Balances on secured AND unsecured debts (needed for Schedules D and E/F).

   She ALSO captures the NAMES: employer name(s) for wage income, business / self-employment income and its name, and the name of every income source. The named sources drive the document requests (paystubs, bank statements, benefit letters, P&L, etc.).

   **Critical guardrail:** every client-entered dollar amount is stored as **CLIENT-ESTIMATED, pending document verification**. The authoritative means-test (Form 122A) figures are still derived from the supporting documents via the paralegal workstation (BestCase YTD method) — NOT from the client's estimates. Betty's numbers give the attorney an initial picture and a complete-looking intake; they must never silently become the means-test input.

4. **Betty gathers; she does not advise.** She never determines eligibility, never tells a client they qualify or don't, never gives legal advice or strategy. She collects information and hands it to the attorney plus the existing eligibility / means-test engine. If a client asks "do I qualify?", she explains that the attorney reviews eligibility and her job is to gather the information for that review. (This is the firm's UPL / liability boundary — hold it firmly.)

5. **No outcome promises, no pressure.** No "you'll get a discharge," no urgency tactics, no guarantees.

## Document requests
The source/asset/debt NAMES Betty captures drive the tailored document request: for each named income source, asset, and creditor, the firm requests the matching supporting document. "Names of sources" → document checklist. Reuse the existing document-request logic; do not rebuild it.

## Confirm + complete before submit
**Every question must be answered — no question is skippable.** Betty cannot submit an intake that has any question left unanswered; if the client tries to skip or move on, she circles back and gets the answer. Before push-through, she reviews all answers back to the client, confirms them, and verifies the ENTIRE intake form is complete. Only a confirmed, fully-answered intake is submitted to attorney review.

## Persistence + push-through
- **Save/resume:** persist progress per session (the Change-2 `questionnaire_sessions` concept). A client can leave and return without losing answers.
- **On completion ("push through"):** submit onto the canonical `intake_leads.id` matter spine — write the `intake_submission` keyed to `lead_id` — which then flows to the attorney review queue via the case-identity wiring already in place.
- **Firm-scoped** throughout (the client's firm).

## Architecture / guardrails
- **Server-side AI integration** (the SaaS backend calls the model) — NOT client-side API keys. Conversation and answers persisted in Supabase, firm-scoped. This handles real PII/financial data; treat it as a production feature, not a throwaway.
- **No agent SQL migrations** — any new tables/columns (e.g. `questionnaire_sessions`) get specced for Canelo in `docs/schema-changes-for-canelo.md`.
- **Reuse the existing engine and components** — do not reimplement the questionnaire or the eligibility/means-test engine.
- Gates: typecheck trending down from baseline, build green, vitest passing.

## Two entry points, one engine
- **Intake:** the GetHelpEntry "Chat now" option (currently a stub) opens Betty.
- **Client portal:** signed-in clients can start or continue intake with Betty.
Both drive the same engine and the same persistence.

## What Betty must NOT do
- Treat client-estimated amounts as verified means-test figures (they are pending document verification).
- Make eligibility determinations or give legal advice.
- Touch the contents of the household-goods section.
- Modify the locked questionnaire file.
- Fork a separate question set or a separate means-test.

## Build approach
**Plan first.** Recon the shared questionnaire engine, the GetHelpEntry "Chat now" stub, the client-portal mount, and the existing document-request logic. Then propose a phased build plan — for example:
1. Chat-mode adapter over the shared questionnaire engine.
2. Betty chat UI + persona + the yes/no + named-source conversation flow.
3. Persistence / save-resume (`questionnaire_sessions` — schema to Canelo).
4. Push-through to the `lead_id` spine → attorney review.
5. Document-request wiring from captured source names.
6. Wire the two entry points (intake "Chat now" + client portal).

Stop for approval before building. Checkpoint each phase with a diff.
