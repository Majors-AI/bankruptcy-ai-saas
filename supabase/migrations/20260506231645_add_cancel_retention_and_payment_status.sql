/*
  # Cancel Retention Tracking & Payment Status

  ## Overview
  Adds support for:
  1. Cancel retention adjustments — when a client who wanted to cancel is saved via a fee reduction,
     payment push, or plan adjustment, we record the outcome and what was changed.
  2. A `cancel_retention_adjustments` table that logs each retention action taken per cancel request,
     including type (reduce_payments, push_payments, reduce_fee, other), before/after values,
     and who authorized it.
  3. Retention metrics view columns on `accounting_cancel_requests` — `retention_type` (saved_reduce_fee,
     saved_push_payments, saved_reduce_payments, saved_other, cancelled), `retention_notes`,
     `adj_original_amount`, `adj_new_amount`, `adj_pushed_to_date`, `adj_authorized_by`.

  ## Tables Modified
  - `accounting_cancel_requests` — adds retention detail columns

  ## New Tables
  - `cancel_retention_adjustments` — one row per retention action, linked to a cancel_request

  ## Security
  - RLS enabled on new table with anon SELECT/INSERT/UPDATE policies (consistent with rest of project)
*/

-- 1. Add retention detail columns to accounting_cancel_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_cancel_requests' AND column_name = 'retention_type'
  ) THEN
    ALTER TABLE accounting_cancel_requests
      ADD COLUMN retention_type text
        CHECK (retention_type IN ('saved_reduce_fee','saved_push_payments','saved_reduce_payments','saved_other','cancelled'))
        DEFAULT NULL,
      ADD COLUMN retention_notes text DEFAULT NULL,
      ADD COLUMN adj_original_amount numeric(10,2) DEFAULT NULL,
      ADD COLUMN adj_new_amount numeric(10,2) DEFAULT NULL,
      ADD COLUMN adj_pushed_to_date date DEFAULT NULL,
      ADD COLUMN adj_authorized_by text DEFAULT NULL,
      ADD COLUMN adj_authorized_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- 2. Create cancel_retention_adjustments table
CREATE TABLE IF NOT EXISTS cancel_retention_adjustments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancel_request_id    uuid NOT NULL REFERENCES accounting_cancel_requests(id) ON DELETE CASCADE,
  client_id            uuid NOT NULL,
  adjustment_type      text NOT NULL
    CHECK (adjustment_type IN ('reduce_fee','push_payments','reduce_payments','waive_fee','change_frequency','other')),
  description          text NOT NULL DEFAULT '',
  original_value       numeric(10,2) DEFAULT NULL,
  new_value            numeric(10,2) DEFAULT NULL,
  original_date        date DEFAULT NULL,
  new_date             date DEFAULT NULL,
  original_frequency   text DEFAULT NULL,
  new_frequency        text DEFAULT NULL,
  authorized_by        text NOT NULL DEFAULT '',
  notes                text DEFAULT NULL,
  applied_at           timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cancel_retention_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read cancel retention adjustments"
  ON cancel_retention_adjustments FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon can insert cancel retention adjustments"
  ON cancel_retention_adjustments FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update cancel retention adjustments"
  ON cancel_retention_adjustments FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cancel_retention_adj_cancel_request_id
  ON cancel_retention_adjustments (cancel_request_id);

CREATE INDEX IF NOT EXISTS idx_cancel_retention_adj_client_id
  ON cancel_retention_adjustments (client_id);

-- 3. Add anon INSERT policy to accounting_cancel_requests if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'accounting_cancel_requests' AND policyname = 'anon can insert cancel requests'
  ) THEN
    EXECUTE 'CREATE POLICY "anon can insert cancel requests"
      ON accounting_cancel_requests FOR INSERT TO anon WITH CHECK (true)';
  END IF;
END $$;

-- 4. Add anon UPDATE policy to accounting_cancel_requests if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'accounting_cancel_requests' AND policyname = 'anon can update cancel requests'
  ) THEN
    EXECUTE 'CREATE POLICY "anon can update cancel requests"
      ON accounting_cancel_requests FOR UPDATE TO anon USING (true) WITH CHECK (true)';
  END IF;
END $$;
