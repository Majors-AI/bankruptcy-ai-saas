/*
  # Appointment Reminders and Department Calendar Enhancements

  ## Summary
  Adds infrastructure for:

  1. **appointment_reminders** — tracks which reminder intervals (30/15/5 min)
     have been shown for each calendar event, so reminders don't repeat on
     page refresh and can be dismissed.

  2. **calendar_events enhancements** — adds `department` column so events can
     be filtered to intake / paralegal / attorney department calendars.

  ## New Tables
  - `appointment_reminders` — one row per event per interval (30, 15, 5 min)

  ## Modified Tables
  - `calendar_events` — adds `department` text column

  ## Security
  - RLS enabled with anon read/write (matches existing project pattern)
*/

-- ─── appointment_reminders ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL,
  minutes_before integer NOT NULL CHECK (minutes_before IN (5, 15, 30)),
  shown_at     timestamptz DEFAULT now(),
  dismissed    boolean DEFAULT false,
  dismissed_at timestamptz,
  UNIQUE (event_id, minutes_before)
);

ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read appointment_reminders"
  ON appointment_reminders FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert appointment_reminders"
  ON appointment_reminders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update appointment_reminders"
  ON appointment_reminders FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── calendar_events — department column ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'department'
  ) THEN
    ALTER TABLE calendar_events
      ADD COLUMN department text DEFAULT 'all'
        CHECK (department IN ('all', 'intake', 'paralegal', 'attorney', 'accounting'));
  END IF;
END $$;

-- Back-fill existing events based on calendar_type
UPDATE calendar_events SET department = 'intake'    WHERE calendar_type = 'intake'        AND department = 'all';
UPDATE calendar_events SET department = 'paralegal' WHERE calendar_type = 'doc_review'    AND department = 'all';
UPDATE calendar_events SET department = 'attorney'  WHERE calendar_type IN ('signing', 'court_hearing', 'court_deadline') AND department = 'all';
