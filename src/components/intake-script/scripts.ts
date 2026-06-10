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

// ─── Intro (read at the start of the intake call) ────────────────────────────
//
// Placeholders are intentionally left as literal `{firmName}` / `{staffName}` /
// `{staffTitle}` / `{supervisingAttorney}` text — the live build interpolates
// from firm + auth context. Until that wiring lands, the wrapper renders the
// placeholders as-is so the staffer reads them verbatim and the firm can
// validate the script before substitution goes live.
//
// TODO Phase B — placeholder resolution:
//   - firmName              → read from `firms` table by viewer.firm_id
//   - staffName / staffTitle → from the authenticated session (already on
//                              StaffGuidedIntakeProps.session — currently
//                              unused per spec to keep the placeholders literal)
//   - supervisingAttorney   → lookup the staffer's assigned attorney (the
//                              Staff Settings supervisor framework — see the
//                              Super Admin Setting Portal Staff Settings card)
export const INTAKE_INTRO_SCRIPT = `"Hi, my name is {staffName} and I'm a {staffTitle} here at {firmName}. I'm not an attorney — I work under the supervision of our supervising attorney, {supervisingAttorney}. All legal advice and case-acceptance decisions come from the attorney. I'm here to help guide you through gathering your information and to help you get answers about your bankruptcy eligibility."`;

// ─── Closing (shown BEFORE the submit-for-attorney-review action) ────────────
//
// Verbatim sections per firm-approved spec. Each entry is rendered as a
// heading + read-aloud body in the closing meta-section. Headings remain
// stable so an attorney can scan-review the script at a glance.
export interface ClosingScriptBlock {
  /** Section heading as it appears in the UI (and is read by the staffer). */
  heading: string;
  /** Read-aloud body verbatim. */
  body: string;
}

/** The closing lead-in line read PROMINENTLY before any body content. */
export const INTAKE_CLOSING_LEAD_IN =
  `"We are not lawyers. All information and cases are reviewed by a licensed attorney."`;

/** Visible attorney-reviewed banner under the lead-in. */
export const INTAKE_CLOSING_BANNER =
  `General information about the bankruptcy process — reviewed and approved by our attorneys. Not legal or financial advice about your specific case.`;

export const INTAKE_CLOSING_BLOCKS: ClosingScriptBlock[] = [
  {
    heading: "WHAT HAPPENS NOW",
    body:
`"Here's what happens next:
1. One of our attorneys is now actively reviewing your case and will determine whether we can accept it.
2. If your case is accepted, the attorney will let you know which chapter you'll file, the fee, and any legal advice specific to your situation. All legal advice and the decision to accept your case come from the attorney — not from me.
While the attorney reviews your file, let me walk you through the basics of how a bankruptcy filing works. Everything I'm about to share is general information, reviewed and approved by our attorneys, and is not legal or financial advice about your specific case."`,
  },
  {
    heading: "CHAPTER 7 vs CHAPTER 13",
    body:
`"There are two main chapters most individuals file. Chapter 7 is a liquidation — generally available if your income is below the state median or you otherwise pass what's called the 'means test.' It typically moves quickly and can eliminate qualifying unsecured debts. Chapter 13 is a repayment plan that lasts 3 to 5 years; the amount you pay into the plan is based on your income — specifically your disposable income after allowed expenses. Chapter 13 is often used when income is higher, or when you want to catch up on a mortgage or car or keep property that isn't fully protected. Which chapter fits is something the attorney decides after reviewing your full financial picture."`,
  },
  {
    heading: "LISTING EVERYTHING",
    body:
`"For either chapter, the law requires you to list all of your income and all of your assets — nothing left off. The attorney will review whether you have any non-exempt assets — property not fully protected by exemptions — or any other issues that could come up, and how to address them."`,
  },
  {
    heading: "FILING, CASE NUMBER & THE AUTOMATIC STAY",
    body:
`"Once your documents are finalized and your case is filed, the court generates a case number and the 'automatic stay' goes into effect immediately. The automatic stay is a powerful protection: it stops most collection activity against you. Lawsuits and other legal actions pause, wage garnishments stop, and creditors must stop contacting you to collect."`,
  },
  {
    heading: "YOUR 341 MEETING",
    body:
`"After you file, you'll have a 341 meeting — a meeting of creditors, currently held over Zoom. You won't be alone; one of our attorneys will be there with you. You'll need to provide certain documents to the trustee, and our office handles getting those to the trustee — but you must get us your updated records at least 10 days before your hearing, or the meeting may have to be continued. It's important that you attend: if you fail to appear, your case can be dismissed."`,
  },
  {
    heading: "DISCHARGE",
    body:
`"After your 341 meeting, it's generally about 60 to 90 days until the court enters your discharge, assuming no creditor raises an objection. The discharge is the court order that releases you from your qualifying debts."`,
  },
  {
    heading: "ESTATE PROPERTY, NO-DISTRIBUTION REPORT & CLOSING",
    body:
`"When you file, a 'bankruptcy estate' is created — essentially all of your property interests as of the filing date. In most consumer cases your property is protected by exemptions. If the trustee decides there's no non-exempt property worth collecting for creditors, the trustee files a 'report of no distribution.' After that, the judge typically signs an order closing your case — generally about 90 to 120 days after that report, and sometimes sooner."`,
  },
  {
    heading: "REBUILDING CREDIT",
    body:
`"Here's something many people don't realize: once your case is filed, you can begin rebuilding your credit right away. Per our attorneys, we typically see clients rehabilitate their credit within the first year, and within about two years many clients are in a position to buy a home — often through FHA financing — provided they meet the lender's requirements. That's general information based on what we've seen with most clients, not financial advice or a guarantee about your situation."`,
  },
  {
    heading: "NEXT STEP",
    body:
`"Once the attorney finishes reviewing your case and it comes back to us, we'll move into the case presentation step, where we go over the attorney's decision, your chapter, and your fee."`,
  },
];
