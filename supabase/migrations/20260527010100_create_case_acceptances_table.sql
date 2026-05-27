/*
  # Create case_acceptances table

  Source: CaseAcceptanceFlow.tsx (MAJ-61 Phase 6 migration)

  This table holds case acceptance records created when an attorney accepts a case.
  CaseAcceptanceFlow.tsx updates this record as the presentation progresses.

  NOTE: CaseAcceptanceFlow.tsx only UPDATEs this table (.eq("client_id", clientId)).
  The initial INSERT must happen when the attorney accepts the case. The attorney portal
  currently writes to attorney_case_acceptances (keyed by lead_id). When the staff
  launches a presentation, a corresponding row in case_acceptances must also be
  inserted — keyed by client_id — so that CaseAcceptanceFlow.tsx can update it.
  This can be done by extending the attorney acceptance flow or by a trigger.

  ## Columns derived from CaseAcceptanceFlow.tsx .from("case_acceptances") calls:

  completeOnboarding():
    onboarding_script_completed, down_payment, payment_plan_amount,
    payment_plan_total_periods, payment_plan_balance, last_payment_amount

  requestWelcomeCall():
    down_payment, payment_plan_amount, payment_plan_total_periods,
    payment_plan_balance, last_payment_amount

  ## Additional columns:
    client_id  — the FK used in all WHERE clauses (.eq("client_id", clientId))
    lead_id    — FK to intake_leads(id), added for MAJ-61 destination-repo linkage
    chapter, attorney_fee, filing_fee, credit_counseling_fee, is_bifurcated,
    accepted_by, acceptance_notes, decided_at — pre-populated at acceptance time
*/

CREATE TABLE IF NOT EXISTS case_acceptances (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  client_id                   uuid REFERENCES clients(id) ON DELETE CASCADE,
  -- MAJ-61: parallel link back to the intake_leads pipeline
  lead_id                     uuid REFERENCES intake_leads(id) ON DELETE SET NULL,

  -- Acceptance data (pre-populated when attorney accepts case)
  chapter                     text,
  -- '7' | '13'

  attorney_fee                numeric(10,2),
  filing_fee                  numeric(10,2),
  credit_counseling_fee       numeric(10,2),
  is_bifurcated               boolean NOT NULL DEFAULT false,
  accepted_by                 text,
  acceptance_notes            text,
  decided_at                  timestamptz,

  -- Payment plan (updated by CaseAcceptanceFlow.tsx)
  onboarding_script_completed boolean NOT NULL DEFAULT false,
  down_payment                numeric(10,2),
  payment_plan_amount         numeric(10,2),
  payment_plan_total_periods  integer,
  payment_plan_balance        numeric(10,2),
  last_payment_amount         numeric(10,2),

  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_acceptances_client_id_idx ON case_acceptances(client_id);
CREATE INDEX IF NOT EXISTS case_acceptances_lead_id_idx   ON case_acceptances(lead_id);

ALTER TABLE case_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read case_acceptances"
  ON case_acceptances FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert case_acceptances"
  ON case_acceptances FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update case_acceptances"
  ON case_acceptances FOR UPDATE TO anon USING (true) WITH CHECK (true);
