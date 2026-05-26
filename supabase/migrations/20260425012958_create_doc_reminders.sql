/*
  # Create doc_reminders table

  ## Purpose
  Tracks document-refresh reminders for bankruptcy clients. When a new calendar
  month starts, time-sensitive documents (pay stubs, bank statements) from the
  prior month must be refreshed. This table:

  1. New Tables
    - `doc_reminders`
      - `id` (uuid, pk)
      - `client_id` (text) — matches session_progress.client_id
      - `doc_id` (text) — matches REQUIRED_DOCS id (e.g. "paystub_1")
      - `doc_label` (text) — human-readable document name
      - `reminder_type` (text) — "month_rollover" | "advance_7day" | "available_now"
      - `due_month` (text) — YYYY-MM of the month the new doc is needed for
      - `available_date` (date) — estimated date the document will be available
      - `reminder_date` (date) — date to surface the reminder (7 days prior)
      - `last_paystub_period_end` (date, nullable) — parsed end date from last paystub AI read
      - `pay_frequency` (text, nullable) — "Bi-Weekly" | "Semi-Monthly" | "Monthly" etc.
      - `dismissed` (boolean, default false)
      - `acknowledged_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled
    - Authenticated users can read/update only their own rows (matched by client_id = auth.uid()::text)
    - Insert allowed for authenticated users for their own client_id
*/

CREATE TABLE IF NOT EXISTS doc_reminders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               text NOT NULL DEFAULT '',
  doc_id                  text NOT NULL DEFAULT '',
  doc_label               text NOT NULL DEFAULT '',
  reminder_type           text NOT NULL DEFAULT 'month_rollover',
  due_month               text NOT NULL DEFAULT '',
  available_date          date,
  reminder_date           date,
  last_paystub_period_end date,
  pay_frequency           text,
  dismissed               boolean NOT NULL DEFAULT false,
  acknowledged_at         timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE doc_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own reminders"
  ON doc_reminders FOR SELECT
  TO authenticated
  USING (client_id = auth.uid()::text);

CREATE POLICY "Clients can insert own reminders"
  ON doc_reminders FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid()::text);

CREATE POLICY "Clients can update own reminders"
  ON doc_reminders FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid()::text)
  WITH CHECK (client_id = auth.uid()::text);
