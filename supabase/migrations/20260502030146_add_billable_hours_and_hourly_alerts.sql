/*
  # Add billable hours tracking and extend fund notices for hourly billing alerts

  1. Changes to accounting_fee_structures
     - `billable_hours` (numeric) — tracks hours billed for Ch. 13 hourly clients
     - `billable_alert_threshold` (numeric) — alert threshold in dollars (default $500)
     - `billable_alert_sent` (boolean) — whether the $500+ billable alert has been triggered

  2. Changes to accounting_fund_notices
     - `notice_type` now also supports 'hourly_billing_alert' in addition to 'filing_fee_transfer_ready'
     - `billable_amount` (numeric) — used for hourly billing alert notices

  3. Security
     - No RLS changes needed; existing anon policies cover new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'billable_hours'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN billable_hours numeric(8,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'billable_alert_threshold'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN billable_alert_threshold numeric(10,2) NOT NULL DEFAULT 500;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'billable_alert_sent'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN billable_alert_sent boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fund_notices' AND column_name = 'billable_amount'
  ) THEN
    ALTER TABLE accounting_fund_notices ADD COLUMN billable_amount numeric(10,2);
  END IF;
END $$;
