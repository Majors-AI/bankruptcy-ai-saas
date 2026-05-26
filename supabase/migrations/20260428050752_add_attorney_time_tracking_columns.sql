/*
  # Add attorney time-tracking columns to case_time_entries

  ## Summary
  Adds columns needed for attorney review session tracking:
  - `attorney_name` — which attorney was in the file
  - `duration_seconds` — how long the session lasted
  - `entry_source` — where the entry originated: "auto" (system-generated on enter/exit) or "manual" (attorney entered manually)
  - `activity_log` — JSONB array of tab/section activity events recorded during the session
  - `billable` — whether the entry is marked billable

  ## Changes
  - ALTER TABLE case_time_entries — adds 5 new nullable columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_entries' AND column_name = 'attorney_name'
  ) THEN
    ALTER TABLE case_time_entries ADD COLUMN attorney_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_entries' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE case_time_entries ADD COLUMN duration_seconds integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_entries' AND column_name = 'entry_source'
  ) THEN
    ALTER TABLE case_time_entries ADD COLUMN entry_source text DEFAULT 'auto';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_entries' AND column_name = 'activity_log'
  ) THEN
    ALTER TABLE case_time_entries ADD COLUMN activity_log jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_time_entries' AND column_name = 'billable'
  ) THEN
    ALTER TABLE case_time_entries ADD COLUMN billable boolean DEFAULT true;
  END IF;
END $$;
