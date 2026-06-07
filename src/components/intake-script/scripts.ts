// Staff-intake script content. Source of truth for `StaffGuidedIntake.tsx`.
//
// Mapping to BankruptcyIntake's 10 sections (the SECTIONS array in
// src/BankruptcyIntake.jsx):
//   0  Filing Type             → residency + identity (merged) + exemption-preview note
//   1  Household                → household
//   2  Income                   → income
//   3  Real Property            → real-prop + HOA / mobile-home sub-notes
//   4  Personal Property        → personal-prop
//   5  Expenses                 → expenses
//   6  Debts                    → debts
//   7  Financial History        → history
//   8  Personal Injury Screen   → NEW (factual asset-disclosure framing — attorneys
//                                  will vet final wording)
//   9  Review & Submit          → review (verbatim) + submission-confirmation sub-note
//
// Steps 1-7 plus the embedded step-9 "review" text are COPIED verbatim from
// `CONSULT_SCRIPTS` in `src/LegalAdminPortal.tsx` (the deprecated
// ConsultIntakeModal). The duplicate will be removed in the follow-up cleanup
// that deletes the ConsultIntakeModal body — until then, that file's copy is
// kept so its dead-code function still type-checks. scripts.ts is the live
// source going forward.
//
// Statutory citations stay out of the spoken script lines per firm direction
// (see `referenceNotes` for side notes the staffer can glance at — the firm's
// attorneys vet any cite-specific wording).

export interface IntakeStepScript {
  /** Index into BankruptcyIntake's SECTIONS array. */
  step: number;
  /** Short heading for the script panel sidebar. */
  title: string;
  /** Primary script text the staffer reads to the client. */
  script: string;
  /** "If applicable" sub-script blocks shown beneath the main script. */
  conditionalNotes?: string[];
  /** Quiet side-references for the staffer (statutes, internal cues). Never spoken. */
  referenceNotes?: string[];
}

export const STAFF_INTAKE_SCRIPTS: IntakeStepScript[] = [
  // ── Step 0 — Filing Type (residency + identity merged) ────────────────────
  {
    step: 0,
    title: "Filing & Residency",
    script: `"Thank you for taking the time to speak with us today. Before we begin, I want to be clear: I am a legal intake specialist, not an attorney. I cannot give you legal advice, and nothing in our conversation today should be taken as legal advice. Your information will be reviewed by one of our licensed attorneys, who will evaluate your case and follow up with you directly.

Let's start with some basic residency information. This helps us determine which state's exemption laws may apply to your case.

Now I'd like to confirm your personal information. Everything you share is kept strictly confidential and used only to prepare your case file for attorney review."`,
    conditionalNotes: [
      `If they haven't lived in their current state for two years, ask where they lived before — the attorney may need to apply a prior state's exemption laws.`,
      `An "Exemptions Preview" panel may appear for the client's state as you fill in residency. That's an early look at what's typically protectable; let the client know the attorney will confirm everything.`,
    ],
  },

  // ── Step 1 — Household ────────────────────────────────────────────────────
  {
    step: 1,
    title: "Household",
    script: `"Next I'll ask about your household. This includes your marital status and any dependents — people who rely on your income. This information is used to calculate your household size, which affects your eligibility and the exemptions available to you."`,
  },

  // ── Step 2 — Income ───────────────────────────────────────────────────────
  {
    step: 2,
    title: "Income",
    script: `"Now let's talk about income. I'll need information about all sources of money coming into your household — employment, self-employment, benefits, or anything else. Please include income from all household members if it contributes to household expenses."`,
  },

  // ── Step 3 — Real Property ────────────────────────────────────────────────
  {
    step: 3,
    title: "Real Property",
    script: `"Now I'd like to ask about any real estate you own — a home, land, investment property, and so on. If you own real estate, it's important to disclose it fully. Our attorney will assess how it fits into your case."`,
    conditionalNotes: [
      `If they own property with an HOA: ask the HOA name, the monthly dues, and whether they're current. Past-due HOA fees can become claims in the case, so the attorney will want to know.`,
      `If the property is a mobile home: ask separately whether they pay lot or space rent — that's tracked as a different expense category.`,
    ],
  },

  // ── Step 4 — Personal Property ────────────────────────────────────────────
  {
    step: 4,
    title: "Personal Property",
    script: `"Next we'll go over your personal property — vehicles, bank accounts, retirement funds, and any other assets. I want to be thorough here: full disclosure of all assets is legally required, and the attorney will need this to advise you properly."`,
  },

  // ── Step 5 — Expenses ─────────────────────────────────────────────────────
  {
    step: 5,
    title: "Expenses",
    script: `"Next, let's go over your monthly living expenses. These are your regular, necessary costs — things like rent, food, utilities, and healthcare. This helps the attorney assess your financial picture and determine eligibility."`,
  },

  // ── Step 6 — Debts ────────────────────────────────────────────────────────
  {
    step: 6,
    title: "Debts",
    script: `"Now let's talk about your debts. I'll need totals by category — secured debts like mortgages and car loans, and unsecured debts like credit cards and medical bills. Accurate debt amounts are essential for the attorney's eligibility analysis."`,
  },

  // ── Step 7 — Financial History ────────────────────────────────────────────
  {
    step: 7,
    title: "Financial History",
    script: `"This section covers your financial history. I'll ask about prior bankruptcies, any pending lawsuits or wage garnishments, recent large transfers of money or property, and whether you've owned a business. Please be as complete as possible — the attorney needs this to protect you and avoid any issues with the court."`,
  },

  // ── Step 8 — Personal Injury Screening (NEW, asset-disclosure framing) ───
  {
    step: 8,
    title: "Personal Injury Screening",
    script: `"I need to ask whether you have any pending or potential personal injury claim. This includes situations like a car accident, slip-and-fall, workplace injury, or medical malpractice — anywhere someone else's actions may have caused you harm or loss.

This matters because a pending claim is treated as an asset in your bankruptcy and has to be listed on the schedules. The attorney will help you figure out how it fits into the case — including whether and how it can be protected. Please describe anything you have going on, even if you haven't filed anything yet."`,
    referenceNotes: [
      `Frame this as asset disclosure (potential bankruptcy asset to identify for scheduling/exemption), not as a PI sales conversation. Whether and how the firm handles any underlying PI matter is a separate decision for the attorney.`,
    ],
  },

  // ── Step 9 — Review & Submit (CONSULT_SCRIPTS.review + sub-note) ──────────
  {
    step: 9,
    title: "Review & Submit",
    script: `"We're almost done. I'd like to review everything we've collected together to make sure it's accurate before it goes to the attorney. If anything needs to be corrected, now is the time. Once submitted, your case will be reviewed and someone from our office will be in touch within 1–2 business days."`,
    conditionalNotes: [
      `Before submitting, confirm with the client that they've received the bankruptcy information sheet and that the information they've provided is accurate to the best of their knowledge.`,
    ],
    referenceNotes: [
      `Federal disclosure obligation around the bankruptcy information sheet — the firm's attorneys will confirm the jurisdiction-specific wording for the client-facing affirmation.`,
    ],
  },
];

/** Convenience lookup by step index. Returns null if step is out of range. */
export function getScriptForStep(step: number): IntakeStepScript | null {
  return STAFF_INTAKE_SCRIPTS.find(s => s.step === step) ?? null;
}
