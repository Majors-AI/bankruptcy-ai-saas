/*
  # Sick Reports + Staff Overrides Integration

  ## Summary
  Links the existing sick_reports table (FirmCalendar) with the
  staff_sick_overrides table (LegalAdminPortal) so both portals
  share a single source of truth for who is out sick.

  Also adds a sick_override_id FK to sick_reports for traceability,
  and adds columns to calendar_events to track "flagged for reschedule"
  state so the UI can surface affected appointments when someone calls in.

  ## Changes

  ### sick_reports
  - Add `sick_override_id` (nullable FK to staff_sick_overrides)
  - Add `flagged_event_ids` jsonb array — list of calendar_event ids needing action
  - Add `resolution` — "pending" | "reassigned" | "rescheduled" | "cancelled" | "no_action"

  ### calendar_events
  - Add `reschedule_flag` boolean — true when flagged due to staff absence
  - Add `reschedule_reason` text — why it was flagged
  - Add `reassigned_from_staff_id` uuid — original staff if reassigned
  - Add `reassigned_to_staff_id` uuid — new staff if reassigned

  ## Security
  - RLS policies allow anon access consistent with rest of codebase
*/

-- Add columns to sick_reports (table created by earlier migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sick_reports' AND column_name = 'sick_override_id'
  ) THEN
    ALTER TABLE sick_reports ADD COLUMN sick_override_id uuid REFERENCES staff_sick_overrides(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sick_reports' AND column_name = 'flagged_event_ids'
  ) THEN
    ALTER TABLE sick_reports ADD COLUMN flagged_event_ids jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sick_reports' AND column_name = 'resolution'
  ) THEN
    ALTER TABLE sick_reports ADD COLUMN resolution text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- Add reschedule tracking columns to calendar_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'reschedule_flag'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN reschedule_flag boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'reschedule_reason'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN reschedule_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'reassigned_from_staff_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN reassigned_from_staff_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'reassigned_to_staff_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN reassigned_to_staff_id uuid;
  END IF;
END $$;

-- Index for quickly finding flagged events
CREATE INDEX IF NOT EXISTS idx_calendar_events_reschedule_flag
  ON calendar_events (reschedule_flag, start_time)
  WHERE reschedule_flag = true;

-- RLS: ensure anon can update calendar_events for flag/reassign operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_events' AND policyname = 'Anon can update calendar events'
  ) THEN
    CREATE POLICY "Anon can update calendar events"
      ON calendar_events FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
