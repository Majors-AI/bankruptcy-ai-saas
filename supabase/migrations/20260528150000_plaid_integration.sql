/*
  # V1 — Plaid integration (Auth + Transactions + Income)

  Records every Plaid Item the client connects, scoped per firm. Each row
  carries the long-lived plaid_access_token (cleartext for V1; production
  rotation to KMS-encrypted column is V1.1).

  Two consent surfaces per client:
    - Bank connection      → product='transactions' or 'auth'
    - Payroll connection   → product='income' (separate Plaid Link launch)

  Each successful link triggers the plaid-fetch-bank-statements /
  plaid-fetch-income edge function which materializes PDFs and inserts
  client_documents rows with phase='03-credit-bank'.

  Adds the payroll_link_plaid feature flag (the BAN-41 feature catalogue
  shipped bank_link_plaid; Plaid Income is a separate consent surface so
  it gets its own toggle).

  Depends on:
    - clients       (from 20260527010000_create_clients_table.sql)
    - firms         (from 20260527020000_firms_and_user_profiles.sql)
    - user_profiles (from 20260527020000_firms_and_user_profiles.sql)
    - feature_flag_definitions  (from 20260528020000_feature_flags.sql)
*/

CREATE TABLE IF NOT EXISTS plaid_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  firm_id               uuid NOT NULL REFERENCES firms(id),
  plaid_item_id         text NOT NULL UNIQUE,
  plaid_access_token    text NOT NULL,
  institution_id        text,
  institution_name      text,
  product               text CHECK (product IN ('auth', 'transactions', 'income', 'identity', 'income_verification')),
  consent_granted_at    timestamptz NOT NULL DEFAULT now(),
  last_sync_at          timestamptz,
  last_sync_error       text,
  revoked_at            timestamptz,
  notes                 text
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_client ON plaid_items(client_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_firm   ON plaid_items(firm_id);

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY plaid_items_super_admin_all ON plaid_items
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

CREATE POLICY plaid_items_firm_all ON plaid_items
  FOR ALL
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- Add the new feature flag for payroll/income link (kept separate from
-- bank_link_plaid because Plaid Income is a discrete consent surface).
INSERT INTO feature_flag_definitions (feature_key, name, category, description) VALUES
  ('payroll_link_plaid', 'Plaid Payroll / Income Connection', 'bank',
   'Connect payroll provider via Plaid Income for paystub + W-2 retrieval (separate consent from bank connection)')
ON CONFLICT (feature_key) DO NOTHING;
