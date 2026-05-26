/*
  # Create credit_report_accounts table

  ## Summary
  Stores individual creditor/tradeline records extracted from uploaded credit reports
  (Stretto, Experian, TransUnion, or Equifax). Each row is one account from the report
  with its assigned bankruptcy schedule classification.

  ## New Tables
  - `credit_report_accounts`
    - `id` (uuid, pk)
    - `client_id` (text) — links to client
    - `creditor_name` (text) — name of the creditor or collection agency
    - `original_creditor` (text, nullable) — original creditor if collection account
    - `account_number` (text, nullable) — masked account number
    - `account_type` (text, nullable) — e.g. credit_card, mortgage, auto_loan
    - `assigned_schedule` (text) — D, E/F-priority, E/F-unsecured, G, H, unknown
    - `current_balance` (text, nullable) — balance as shown on report
    - `status` (text, nullable) — Open, Closed, Collection, etc.
    - `address_line1`, `city`, `state`, `zip`, `phone` — noticing address
    - `report_source` (text) — stretto, experian, transunion, equifax, unknown
    - `report_date` (text, nullable) — date report was pulled
    - `source_bureaus` (text, nullable) — TU, EX, EQ, etc.
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Anon can insert (client portal is unauthenticated demo)
  - Anon can select their own records by client_id
*/

CREATE TABLE IF NOT EXISTS credit_report_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        text NOT NULL DEFAULT 'client-demo',
  creditor_name    text NOT NULL,
  original_creditor text,
  account_number   text,
  account_type     text,
  assigned_schedule text NOT NULL DEFAULT 'unknown',
  current_balance  text,
  status           text,
  address_line1    text,
  city             text,
  state            text,
  zip              text,
  phone            text,
  report_source    text NOT NULL DEFAULT 'unknown',
  report_date      text,
  source_bureaus   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_report_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert credit report accounts"
  ON credit_report_accounts
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can select own client credit report accounts"
  ON credit_report_accounts
  FOR SELECT
  TO anon
  USING (client_id = 'client-demo');

CREATE INDEX IF NOT EXISTS idx_credit_report_accounts_client_id
  ON credit_report_accounts (client_id);
