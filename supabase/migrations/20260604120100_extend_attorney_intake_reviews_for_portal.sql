/*
  # Extend attorney_intake_reviews for the new attorney intake portal

  Source's case_reviews schema carries columns the existing
  attorney_intake_reviews table lacks. Per the agreed mapping, four are
  added as proper columns and four workflow booleans are also added as
  proper columns (not folded into review_status — they are not strictly
  sequential; a case can be returned_to_admin without ever having
  fee_agreement_sent, etc.).

  Columns added:
    - court_district           text  — selected district (e.g., "WAW Seattle")
    - ch7_fee_type             text  — 'normal' | 'bifurcated'
    - ch7_post_filing_fee      numeric(10,2) — snapshot at decision, only
                                     populated when ch7_fee_type='bifurcated'
                                     AND total_fee + down_payment both present.
                                     Never recomputed on read.
    - confirmation_sent        boolean — acceptance email sent?
    - client_advisory_notes    text   — distinct from decision_notes /
                                        eligibility_notes (per source schema)
    - fee_agreement_sent       boolean — BoldSign sent
    - payment_initiated        boolean — Stripe link issued
    - returned_to_admin        boolean — kicked back to admin for more info
    - closed_by_ai             boolean — AI determined no-case
*/

ALTER TABLE attorney_intake_reviews
  ADD COLUMN IF NOT EXISTS court_district        text          DEFAULT '',
  ADD COLUMN IF NOT EXISTS ch7_fee_type          text          DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ch7_post_filing_fee   numeric(10,2),
  ADD COLUMN IF NOT EXISTS confirmation_sent     boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_advisory_notes text          DEFAULT '',
  ADD COLUMN IF NOT EXISTS fee_agreement_sent    boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_initiated     boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_to_admin     boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_by_ai          boolean       DEFAULT false;
