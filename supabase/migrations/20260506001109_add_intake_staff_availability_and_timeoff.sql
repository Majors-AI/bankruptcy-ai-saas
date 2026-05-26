/*
  # Intake Staff Availability & Time-Off Extensions

  1. New Tables
    - `intake_staff_time_off` — individual dated time-off blocks for legal admin staff
      (distinct from firm-wide pto_requests; legal admin self-service)

  2. Extend staff_availability
    - `department` column so availability records can be scoped to 'intake' vs others

  3. Extend calendar_events
    - `lead_id` already exists; ensure `event_subtype` supports intake consultation subtypes

  4. Seed default intake availability for the demo legal admin (staff id ...0004)
     Mon–Fri 9:00–17:00, lunch 12–13, max 8 consultations/day, 20-min buffer

  5. Security — RLS anon read/write for intake_staff_time_off
*/

-- ── Extend staff_availability with department scope ───────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='staff_availability' AND column_name='department'
  ) THEN
    ALTER TABLE staff_availability ADD COLUMN department text DEFAULT 'general';
  END IF;
END $$;

-- ── intake_staff_time_off ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intake_staff_time_off (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid REFERENCES staff_members(id),
  staff_name      text NOT NULL DEFAULT '',
  date            date NOT NULL,
  time_off_type   text NOT NULL DEFAULT 'full_day',
  -- 'full_day' | 'morning' | 'afternoon' | 'custom'
  start_time      time,
  end_time        time,
  reason          text,
  -- 'vacation' | 'sick' | 'personal' | 'training' | 'other'
  reason_type     text DEFAULT 'personal',
  approved        boolean DEFAULT false,
  approved_by     text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE intake_staff_time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read intake time off"
  ON intake_staff_time_off FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert intake time off"
  ON intake_staff_time_off FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update intake time off"
  ON intake_staff_time_off FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete intake time off"
  ON intake_staff_time_off FOR DELETE TO anon USING (true);

-- ── Seed default availability for legal admin staff member (id ...0004) ────────

INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_available, max_consultations_per_day, min_gap_between_appts_min, preferred_gap_minutes, lunch_start, lunch_end, department)
SELECT
  '11111111-0000-0000-0000-000000000004',
  d.dow,
  '09:00'::time,
  '17:00'::time,
  true,
  8,
  15,
  20,
  '12:00'::time,
  '13:00'::time,
  'intake'
FROM (VALUES (1),(2),(3),(4),(5)) AS d(dow)
ON CONFLICT (staff_id, day_of_week) DO UPDATE SET
  department = 'intake',
  max_consultations_per_day = 8,
  min_gap_between_appts_min = 15,
  preferred_gap_minutes = 20,
  lunch_start = '12:00'::time,
  lunch_end = '13:00'::time;

-- ── Seed a few sample future time-off blocks ─────────────────────────────────

INSERT INTO intake_staff_time_off (staff_id, staff_name, date, time_off_type, reason_type, reason, approved)
VALUES
  ('11111111-0000-0000-0000-000000000004', 'Lisa Chen', CURRENT_DATE + 7,  'full_day',  'vacation', 'Planned vacation day',   true),
  ('11111111-0000-0000-0000-000000000004', 'Lisa Chen', CURRENT_DATE + 8,  'full_day',  'vacation', 'Planned vacation day',   true),
  ('11111111-0000-0000-0000-000000000004', 'Lisa Chen', CURRENT_DATE + 21, 'afternoon', 'personal', 'Personal appointment',   false)
ON CONFLICT DO NOTHING;
