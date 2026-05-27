/*
  # Create clients table

  Source: CaseAcceptanceFlow.tsx (MAJ-61 Phase 6 migration)

  This table holds client records created via ClientRegistration and updated
  throughout the intake → presentation → retention lifecycle.

  ## Columns derived from CaseAcceptanceFlow.tsx .from("clients") calls:

  startSession():
    presentation_started_at, presentation_step

  saveStep():
    presentation_step, onboarding_step

  startAttorneyCall():
    attorney_call_requested_at

  endAttorneyCall():
    attorney_call_completed_at

  completeOnboarding():
    onboarding_completed, status, case_status, presentation_completed_at,
    client_decision, down_payment, payment_plan_amount,
    payment_plan_total_periods, payment_plan_balance, last_payment_amount

  deferOnboarding():
    deferred_followup_date, case_status, client_decision

  requestWelcomeCall():
    case_status, down_payment, payment_plan_amount,
    payment_plan_total_periods, payment_plan_balance, last_payment_amount

  markWelcomeCallComplete():
    case_status

  ## Additional columns:
    name, email, phone, status — inserted by ClientRegistration.tsx
    intake_id, intake_completed_at, last_activity — written by BankruptcyIntake.jsx
    lead_id — FK to intake_leads(id), added for MAJ-61 destination-repo linkage
*/

CREATE TABLE IF NOT EXISTS clients (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- MAJ-61: links this client record back to the intake_leads pipeline
  lead_id                     uuid REFERENCES intake_leads(id) ON DELETE SET NULL,

  -- Identity (inserted by ClientRegistration.tsx)
  name                        text NOT NULL DEFAULT '',
  email                       text,
  phone                       text,

  -- Intake linkage (written by BankruptcyIntake.jsx)
  intake_id                   uuid REFERENCES intake_submissions(id) ON DELETE SET NULL,
  intake_completed_at         timestamptz,
  last_activity               timestamptz,

  -- Case lifecycle status
  status                      text NOT NULL DEFAULT 'registered',
  -- 'registered' | 'intake_in_progress' | 'intake_complete'
  -- | 'consultation_scheduled' | 'questionnaire_submitted' | 'retained'

  case_status                 text,
  -- 'accepted_fee_quoted' | 'welcome_call_requested' | 'welcome_call_complete'
  -- | 'retained'

  client_decision             text,
  -- 'ready_to_retain' | 'deferred'

  -- Presentation tracking (written by CaseAcceptanceFlow.tsx)
  presentation_started_at     timestamptz,
  presentation_step           text,
  -- ScriptStep values: 'welcome' | 'case_accepted' | ... | 'done'

  onboarding_step             integer,
  -- Index into STEP_ORDER array

  onboarding_completed        boolean NOT NULL DEFAULT false,
  presentation_completed_at   timestamptz,

  -- Attorney call during presentation
  attorney_call_requested_at  timestamptz,
  attorney_call_completed_at  timestamptz,

  -- Payment plan (written by CaseAcceptanceFlow.tsx at completion / welcome call)
  down_payment                numeric(10,2),
  payment_plan_amount         numeric(10,2),
  payment_plan_total_periods  integer,
  payment_plan_balance        numeric(10,2),
  last_payment_amount         numeric(10,2),

  -- Defer path
  deferred_followup_date      date,

  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_email_idx ON clients(email);
CREATE INDEX IF NOT EXISTS clients_lead_id_idx      ON clients(lead_id);
CREATE INDEX IF NOT EXISTS clients_intake_id_idx    ON clients(intake_id);
CREATE INDEX IF NOT EXISTS clients_status_idx       ON clients(status);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read clients"
  ON clients FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert clients"
  ON clients FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update clients"
  ON clients FOR UPDATE TO anon USING (true) WITH CHECK (true);
