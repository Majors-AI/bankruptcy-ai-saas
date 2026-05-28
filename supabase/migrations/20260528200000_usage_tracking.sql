/*
  # MAJ-89 — Per-firm usage tracking (Phase A: event capture)

  Single table that meters every billable/trackable action across all firms.
  Super Admin reads cross-firm; firm staff reads their own firm's events.
  Client-side and edge-function callers write via anon INSERT (no PII in events).

  Phase A: capture events during V1 pilot (MLG + Neeley comped).
  Phase B: read-only dashboard in Super Admin (also in this PR).
  Phase C: Stripe invoicing engine (V2, not in scope here).

  Depends on:
    - firms    (from 20260527020000_firms_and_user_profiles.sql)
    - clients  (from 20260527010000_create_clients_table.sql)
    - user_profiles (from 20260527020000_firms_and_user_profiles.sql)
    - auth.users (Supabase auth)
*/

CREATE TABLE IF NOT EXISTS firm_usage_events (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           uuid    NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  client_id         uuid    REFERENCES clients(id) ON DELETE SET NULL,
  event_type        text    NOT NULL CHECK (event_type IN (
                              'client_created',
                              'plaid_bank_connected',
                              'plaid_income_connected',
                              'plaid_bank_statement_generated',
                              'plaid_income_doc_generated',
                              'document_uploaded',
                              'bci_export_generated',
                              'zip_export_generated',
                              'sms_sent',
                              'email_sent'
                            )),
  vendor_cost_cents integer NOT NULL DEFAULT 0,
  event_metadata    jsonb   NOT NULL DEFAULT '{}'::jsonb,
  recorded_at       timestamptz NOT NULL DEFAULT now()
);

-- Primary access pattern: fetch all events for a firm ordered by time
CREATE INDEX IF NOT EXISTS idx_firm_usage_events_firm_time
  ON firm_usage_events(firm_id, recorded_at DESC);

-- Secondary: aggregate across all firms by event_type (Super Admin dashboard)
CREATE INDEX IF NOT EXISTS idx_firm_usage_events_type
  ON firm_usage_events(event_type, recorded_at DESC);

ALTER TABLE firm_usage_events ENABLE ROW LEVEL SECURITY;

-- Super admin: full cross-firm access
CREATE POLICY usage_events_super_admin_all ON firm_usage_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  );

-- Firm staff: read their own firm's events
CREATE POLICY usage_events_firm_read ON firm_usage_events
  FOR SELECT
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- Firm staff: write their own firm's events
CREATE POLICY usage_events_firm_insert ON firm_usage_events
  FOR INSERT
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- Anon INSERT: allows client-side logUsageEvent() to fire without a Supabase session.
-- No PII is stored in this table — firm_id + event_type + cost + opaque metadata only.
-- Tighten to authenticated-only once the client auth flow is wired in V2.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'firm_usage_events' AND policyname = 'Anon can insert usage events'
  ) THEN
    EXECUTE '
      CREATE POLICY "Anon can insert usage events" ON firm_usage_events
        FOR INSERT TO anon
        WITH CHECK (true)
    ';
  END IF;
END $$;
