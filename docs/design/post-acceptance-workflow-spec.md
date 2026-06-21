# Post-Acceptance Workflow — Presentation → Welcome Call → Fee Agreement

## Trigger
Attorney accepts the case in the attorney review portal. Case moves to **Ready to Present** (the "Pending Case Presentations" section).

## 1. Scheduling the presentation
- **Client self-served their intake** → client schedules a time for the case-review/presentation appointment. Case stays in **Ready to Present** until the appointment.
- **If the client does NOT schedule:**
  - The follow-up drops onto the **intake task list**.
  - It enters the queue for the **next availability**.
  - The **AI bot** attempts to schedule a presentation call with the client.
- Once scheduled → a **non-lawyer or lawyer** presents the case.

## 2. Presentation outcomes

### A. Client wants to move forward

**If a NON-LAWYER presented:**
1. Client agrees to move forward **and provides payment information to legal admin.**
2. Only then can the **welcome call be requested.**
3. The **attorney conducts the welcome call.**
4. When the attorney **marks the welcome call complete**, the system **releases the fee agreement** to the client.
   - Rationale: an attorney must have direct contact with the client before the engagement is signed. The welcome call satisfies that requirement when a non-lawyer did the presentation.

**If the ATTORNEY presented:**
1. The attorney enters the client's payment info: **downpayment amount, debit card, payment amounts.**
2. If the client is ready, the attorney **sends the fee agreement** (BoldSign).
   - No separate welcome call required — the attorney's presentation already satisfied the attorney-contact requirement.

### B. Client not ready / declines to move forward
- Case goes into the **follow-up queue.**
- The **AI bot gently** tries to get them on the calendar / follow up to move forward — no pressure.
- When the client says **yes**, the bot **refreshes all fee-agreement payment info** and resumes the move-forward flow (→ back into the matching path above).

## Hard gating rules
- The **welcome call can only be requested** after the client agrees to move forward AND payment info has been provided.
- A **completed welcome call is required before fee-agreement release** when a NON-LAWYER presented. Attorney-presented cases skip the separate welcome call (attorney contact already made).
- The fee agreement is released to the client only when its gate is satisfied (welcome call complete for the non-lawyer path; attorney-ready for the attorney path).

## Data / security guardrails
- **Payment / card data is tokenized through the Amex merchant gateway** — the gateway stores the card and returns a token; the firm stores the **token** (plus last-4 + expiry for display), never the raw card number (PAN) or CVV. Charges (downpayment + payment-plan installments) run against the token. This gives full recurring-charge capability without the firm ever holding card data. (Storing the raw PAN puts the firm in full PCI scope and breach liability — the token pattern gives the same capability and avoids that.)
- Payment info, welcome-call status, presentation outcome, and fee-agreement status all attach to the case on the `lead_id` matter spine (§12).
- No agent SQL — schema for welcome-call gate / presentation outcome / tokenized payment goes to Canelo.

## Decisions (resolved)
1. **E-sign provider: BoldSign.**
2. **Scheduling / follow-up bot:** a separate, department-scoped bot from the firm's AI-bot suite (~15 addable bots) — NOT BK Betty. Scheduling is per-department. Gentle, non-pressuring tone.
3. **Payment capture:** both UIs (legal-admin screen on the non-lawyer path, attorney screen on the attorney path); both tokenize through the Amex gateway (see guardrails).
4. **Confirmed:** payment amounts here are fee / engagement figures, separate from the income / means-test figures (which stay document-derived).
