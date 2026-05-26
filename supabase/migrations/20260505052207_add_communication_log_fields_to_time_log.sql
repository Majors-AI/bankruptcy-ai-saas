/*
  # Add communication logging fields to case_time_log

  1. Changes to `case_time_log`
    - `source_type` (text): What triggered this entry — 'manual', 'message', 'email', 'phone_call', 'file_open', 'file_close', 'auto'
    - `is_auto_logged` (boolean): Whether this entry was created automatically by the system
    - `communication_id` (text): Optional reference to the triggering message/email/call record ID

  2. Notes
    - Existing rows get source_type = 'manual', is_auto_logged = false by default
    - No data loss — all existing entries preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_log' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE case_time_log ADD COLUMN source_type text NOT NULL DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_log' AND column_name = 'is_auto_logged'
  ) THEN
    ALTER TABLE case_time_log ADD COLUMN is_auto_logged boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_log' AND column_name = 'communication_id'
  ) THEN
    ALTER TABLE case_time_log ADD COLUMN communication_id text;
  END IF;
END $$;
