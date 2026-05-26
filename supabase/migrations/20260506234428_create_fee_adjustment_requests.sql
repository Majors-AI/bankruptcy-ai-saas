/*
  # Fee Adjustment Requests

  ## Purpose
  Tracks attorney fee, court filing fee, and payment plan adjustment requests
  that require super admin attorney approval before being applied.

  ## New Tables

  ### fee_adjustment_requests
  - `id` — UUID primary key
  - `client_id` — references accounting_clients
  - `client_name` — denormalized for display
  - `adjustment_type` — 'attorney_fee' | 'court_filing_fee' | 'payment_amount' | 'payment_plan'
  - `original_attorney_fee` — current attorney fee
  - `original_court_filing_fee` — current court filing fee
  - `original_total_fee` — current total fee
  - `original_payment_amount` — current payment amount per installment
  - `original_plan_months` — current plan months
  - `original_payment_frequency` — current frequency
  - `proposed_attorney_fee` — proposed new attorney fee (nullable)
  - `proposed_court_filing_fee` — proposed new court filing fee (nullable)
  - `proposed_payment_amount` — proposed new payment per installment (nullable)
  - `proposed_plan_months` — proposed new plan months (nullable)
  - `proposed_payment_frequency` — proposed new frequency (nullable)
  - `reason` — staff-provided reason for the change
  - `requested_by` — staff member name
  - `status` — 'pending' | 'approved' | 'rejected'
  - `reviewed_by` — super admin attorney name
  - `reviewed_at` — timestamp of review
  - `review_notes` — notes from reviewer
  - `applied_at` — when the adjustment was actually applied to fee structure
  - `created_at`

  ## Security
  - RLS enabled
  - Anon users can read, insert, update (consistent with rest of project)
*/

CREATE TABLE IF NOT EXISTS fee_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  client_name text NOT NULL,
  fee_structure_id uuid,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('attorney_fee', 'court_filing_fee', 'payment_plan', 'multiple')),
  -- Original values (snapshotted at time of request)
  original_attorney_fee numeric(10,2) NOT NULL DEFAULT 0,
  original_court_filing_fee numeric(10,2) NOT NULL DEFAULT 0,
  original_total_fee numeric(10,2) NOT NULL DEFAULT 0,
  original_payment_amount numeric(10,2),
  original_plan_months integer,
  original_payment_frequency text,
  -- Proposed values (only populated for the fields being changed)
  proposed_attorney_fee numeric(10,2),
  proposed_court_filing_fee numeric(10,2),
  proposed_payment_amount numeric(10,2),
  proposed_plan_months integer,
  proposed_payment_frequency text,
  -- Request metadata
  reason text NOT NULL,
  requested_by text NOT NULL,
  -- Review
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fee_adjustment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read fee adjustment requests"
  ON fee_adjustment_requests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert fee adjustment requests"
  ON fee_adjustment_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update fee adjustment requests"
  ON fee_adjustment_requests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
