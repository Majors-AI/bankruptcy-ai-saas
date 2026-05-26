/*
  # Add Down Payment, Plan Months, and CFF Workflow Fields

  1. Changes to `accounting_fee_structures`
     - `down_payment` (numeric) — initial payment collected at intake
     - `plan_months` (integer) — number of months to pay off remaining balance (4–6 for regular Ch.7)
     - `first_payment_date` (date) — when the first scheduled installment is due
     - `cff_payment_link_sent` (boolean) — whether the CFF payment link has been sent to client
     - `cff_payment_link_sent_at` (timestamptz) — when the link was sent
     - `cff_paid` (boolean) — whether the court filing fee has been collected
     - `cff_paid_at` (timestamptz) — when CFF was collected
     - `approved_for_signing` (boolean) — whether client has been approved to schedule signing appointment

  2. No destructive changes — all columns added with safe defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'down_payment'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN down_payment numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'plan_months'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN plan_months integer NOT NULL DEFAULT 4;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'first_payment_date'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN first_payment_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'cff_payment_link_sent'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN cff_payment_link_sent boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'cff_payment_link_sent_at'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN cff_payment_link_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'cff_paid'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN cff_paid boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'cff_paid_at'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN cff_paid_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'approved_for_signing'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN approved_for_signing boolean NOT NULL DEFAULT false;
  END IF;
END $$;
