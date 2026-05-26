/*
  # Legal Admin / Intake Portal Schema

  1. New / Extended Tables
    - `intake_leads` — extended with more detail columns (pre-screening notes, preferred contact, urgency)
    - `attorney_case_acceptances` — attorney decision record for each intake submission
      - Stores accepted case type, fee structure, filing fee handling, limited scope description
    - `intake_appointments` — consultation appointments booked through the portal

  2. New Columns on intake_leads
    - `preferred_contact` (text) — 'phone' | 'email' | 'text'
    - `urgency` (text) — 'normal' | 'urgent' | 'emergency'
    - `pre_screen_notes` (text) — legal admin pre-screen summary
    - `ai_scheduled` (boolean) — whether appointment was AI-scheduled
    - `intake_completed` (boolean) — legal admin marked intake form complete
    - `sent_for_review` (boolean) — sent to attorney for review
    - `sent_for_review_at` (timestamptz)
    - `client_prefilled` (boolean) — client filled their own form before appointment
    - `debt_estimate` (numeric) — rough total debt estimate from pre-screen
    - `income_estimate` (numeric) — rough monthly income estimate
    - `state` (text) — state for jurisdiction

  3. attorney_case_acceptances
    - Links to intake_leads and/or intake_submissions
    - Records attorney decision: accepted, declined, needs_more_info
    - Accepted case type: ch7_regular, ch7_bifurcated, ch13_flat_fee, limited_scope
    - Fee amounts, filing fee handling, limited scope description
    - Creates accounting_clients record upon acceptance

  4. Security — RLS enabled, anon can read/insert/update all intake tables
*/

-- ── Extend intake_leads ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='preferred_contact') THEN
    ALTER TABLE intake_leads ADD COLUMN preferred_contact text DEFAULT 'phone';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='urgency') THEN
    ALTER TABLE intake_leads ADD COLUMN urgency text DEFAULT 'normal';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='pre_screen_notes') THEN
    ALTER TABLE intake_leads ADD COLUMN pre_screen_notes text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='ai_scheduled') THEN
    ALTER TABLE intake_leads ADD COLUMN ai_scheduled boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='intake_completed') THEN
    ALTER TABLE intake_leads ADD COLUMN intake_completed boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='sent_for_review') THEN
    ALTER TABLE intake_leads ADD COLUMN sent_for_review boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='sent_for_review_at') THEN
    ALTER TABLE intake_leads ADD COLUMN sent_for_review_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='client_prefilled') THEN
    ALTER TABLE intake_leads ADD COLUMN client_prefilled boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='debt_estimate') THEN
    ALTER TABLE intake_leads ADD COLUMN debt_estimate numeric(12,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='income_estimate') THEN
    ALTER TABLE intake_leads ADD COLUMN income_estimate numeric(12,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='state') THEN
    ALTER TABLE intake_leads ADD COLUMN state text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_leads' AND column_name='submission_id') THEN
    ALTER TABLE intake_leads ADD COLUMN submission_id uuid;
  END IF;
END $$;

-- ── attorney_case_acceptances ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attorney_case_acceptances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid REFERENCES intake_leads(id),
  submission_id         uuid,
  attorney_name         text NOT NULL DEFAULT '',
  decision              text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'declined' | 'needs_more_info'

  -- Accepted case type
  case_type             text,
  -- 'ch7_regular' | 'ch7_bifurcated' | 'ch13_flat_fee' | 'limited_scope'

  chapter               integer,

  -- Fees
  attorney_fee          numeric(10,2),
  court_filing_fee      numeric(10,2),
  total_fee             numeric(10,2),
  down_payment          numeric(10,2),
  plan_months           integer,

  -- Ch. 7 Regular: filing fee separate, must be paid before signing
  -- Ch. 7 Bifurcated: filing fee rolled into attorney fee
  -- Ch. 13: $13 filing fee paid before filing/signing
  filing_fee_handling   text,
  -- 'separate_prepaid' | 'rolled_in' | 'ch13_standard'

  -- Limited scope specifics
  limited_scope_desc    text,
  -- e.g. "Debt negotiation with Capital One and Synchrony Bank"

  -- Plan payment details for Ch. 13
  ch13_upfront_amount   numeric(10,2),
  ch13_plan_portion     numeric(10,2),

  -- Decision notes
  decision_notes        text,

  -- Workflow
  review_requested_at   timestamptz DEFAULT now(),
  decided_at            timestamptz,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE attorney_case_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read case acceptances"
  ON attorney_case_acceptances FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert case acceptances"
  ON attorney_case_acceptances FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update case acceptances"
  ON attorney_case_acceptances FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Seed additional demo leads ────────────────────────────────────────────────

INSERT INTO intake_leads (full_name, phone, email, source, chapter_interest, status, assigned_name, notes, urgency, preferred_contact, debt_estimate, income_estimate, state, ai_scheduled)
VALUES
  ('Carlos Vega',      '(312) 555-0411', 'cvega@email.com',    'inbound',  7,  'new',                    'Lisa Chen',  'Called about credit card debt, possible wage garnishment next month.', 'urgent',  'phone', 48000, 3200, 'IL', false),
  ('Angela Ruiz',      '(602) 555-0187', 'aruiz@email.com',    'referral', 13, 'new',                    'Lisa Chen',  'Referred by Michael Torres. Behind on mortgage 4 months.',           'normal',  'email', 185000, 5100, 'AZ', false),
  ('Kevin Park',       '(206) 555-0293', 'kpark@email.com',    'ad',       7,  'consultation_scheduled', 'Lisa Chen',  'Google Ad lead. Medical debt + job loss.',                           'normal',  'phone', 62000, 2800, 'WA', true),
  ('Brenda Castillo',  '(214) 555-0376', 'bcastillo@email.com','inbound',  7,  'contacted',              'Lisa Chen',  'Student loans + credit cards. Asked about Ch. 7 eligibility.',      'normal',  'text',  91000, 4400, 'TX', false),
  ('James Holloway',   '(312) 555-0512', null,                 'inbound',  7,  'new',                    'Lisa Chen',  'Walk-in. Eviction threat, needs quick review.',                     'emergency','phone', 22000, 1800, 'IL', false),
  ('Priya Sharma',     '(602) 555-0634', 'psharma@email.com',  'referral', 13, 'consultation_scheduled', 'Lisa Chen',  'Rental property underwater. Ch. 13 plan inquiry.',                  'normal',  'email', 340000, 7200, 'AZ', true),
  ('Robert Osei',      '(206) 555-0721', 'rosei@email.com',    'ad',       7,  'sent_for_attorney_review','Lisa Chen', 'Intake complete. Wage garnishment active. Ready for attorney.',     'urgent',  'phone', 55000, 3600, 'WA', false),
  ('Diane Kowalski',   '(214) 555-0849', 'dkowalski@email.com','inbound',  null,'new',                   'Lisa Chen',  'Not sure which chapter. Debt consolidation or BK — needs consult.',  'normal',  'email', 78000, 4900, 'TX', false)
ON CONFLICT DO NOTHING;
