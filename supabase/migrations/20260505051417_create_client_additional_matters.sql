/*
  # Create client_additional_matters table

  1. New Tables
    - `client_additional_matters`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references accounting_clients)
      - `description` (text)
      - `fee_type` (text: flat_fee, hourly, fixed)
      - `amount` (numeric)
      - `hours_billed` (numeric, nullable)
      - `hourly_rate` (numeric, nullable)
      - `status` (text: draft, pending_approval, approved, invoiced, paid, cancelled)
      - `requires_new_agreement` (boolean)
      - `approval_method` (text: client_email, attorney, both)
      - Various approval/document tracking timestamps and IDs
      - `notes` (text, nullable)
      - `created_by` (text, nullable)
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - Enable RLS
    - Authenticated users can read, insert, and update records
*/

CREATE TABLE IF NOT EXISTS client_additional_matters (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                uuid NOT NULL,
  description              text NOT NULL DEFAULT '',
  fee_type                 text NOT NULL DEFAULT 'flat_fee' CHECK (fee_type IN ('flat_fee','hourly','fixed')),
  amount                   numeric NOT NULL DEFAULT 0,
  hours_billed             numeric,
  hourly_rate              numeric,
  status                   text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','invoiced','paid','cancelled')),
  requires_new_agreement   boolean NOT NULL DEFAULT false,
  approval_method          text NOT NULL DEFAULT 'client_email' CHECK (approval_method IN ('client_email','attorney','both')),
  client_approved_at       timestamptz,
  attorney_approved_at     timestamptz,
  attorney_approved_by     text,
  approval_email_sent_at   timestamptz,
  boldsign_document_id     text,
  boldsign_signed_at       timestamptz,
  invoiced_at              timestamptz,
  paid_at                  timestamptz,
  notes                    text,
  created_by               text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_additional_matters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read additional matters"
  ON client_additional_matters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert additional matters"
  ON client_additional_matters FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update additional matters"
  ON client_additional_matters FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
