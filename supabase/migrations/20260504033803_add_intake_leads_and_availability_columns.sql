/*
  # Intake Leads Table + Staff Availability Columns

  Adds:
  - intake_leads table for tracking consultation prospects and follow-ups
  - Additional columns to staff_availability for scheduling spacing logic
  - Additional columns to calendar_events for department + intake subtypes
*/

-- ── Add missing columns to staff_availability ─────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='is_available') THEN
    ALTER TABLE staff_availability ADD COLUMN is_available boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='max_consultations_per_day') THEN
    ALTER TABLE staff_availability ADD COLUMN max_consultations_per_day integer DEFAULT 6;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='min_gap_between_appts_min') THEN
    ALTER TABLE staff_availability ADD COLUMN min_gap_between_appts_min integer DEFAULT 15;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='preferred_gap_minutes') THEN
    ALTER TABLE staff_availability ADD COLUMN preferred_gap_minutes integer DEFAULT 20;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='lunch_start') THEN
    ALTER TABLE staff_availability ADD COLUMN lunch_start time DEFAULT '12:00';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='lunch_end') THEN
    ALTER TABLE staff_availability ADD COLUMN lunch_end time DEFAULT '13:00';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='updated_at') THEN
    ALTER TABLE staff_availability ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- UNIQUE constraint (safe — skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_availability_staff_id_day_of_week_key'
  ) THEN
    ALTER TABLE staff_availability ADD CONSTRAINT staff_availability_staff_id_day_of_week_key UNIQUE (staff_id, day_of_week);
  END IF;
END $$;

-- RLS
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_availability' AND policyname='Anon can read staff availability') THEN
    CREATE POLICY "Anon can read staff availability" ON staff_availability FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_availability' AND policyname='Anon can insert staff availability') THEN
    CREATE POLICY "Anon can insert staff availability" ON staff_availability FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_availability' AND policyname='Anon can update staff availability') THEN
    CREATE POLICY "Anon can update staff availability" ON staff_availability FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default Mon-Fri availability for all staff
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, max_consultations_per_day, min_gap_between_appts_min, preferred_gap_minutes)
SELECT sm.id, d, '09:00'::time, '17:00'::time, 6, 15, 20
FROM staff_members sm, generate_series(1, 5) AS d
ON CONFLICT (staff_id, day_of_week) DO NOTHING;

-- ── Extend calendar_events ────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='department') THEN
    ALTER TABLE calendar_events ADD COLUMN department text DEFAULT 'general';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='event_subtype') THEN
    ALTER TABLE calendar_events ADD COLUMN event_subtype text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='spacing_buffer_minutes') THEN
    ALTER TABLE calendar_events ADD COLUMN spacing_buffer_minutes integer DEFAULT 15;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='is_walk_in') THEN
    ALTER TABLE calendar_events ADD COLUMN is_walk_in boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='phone') THEN
    ALTER TABLE calendar_events ADD COLUMN phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='cal_notes') THEN
    ALTER TABLE calendar_events ADD COLUMN cal_notes text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='outcome') THEN
    ALTER TABLE calendar_events ADD COLUMN outcome text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='retained') THEN
    ALTER TABLE calendar_events ADD COLUMN retained boolean;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='lead_id') THEN
    ALTER TABLE calendar_events ADD COLUMN lead_id uuid;
  END IF;
END $$;

-- ── intake_leads ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intake_leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             text NOT NULL DEFAULT '',
  email                 text,
  phone                 text,
  source                text DEFAULT 'inbound',
  chapter_interest      integer,
  status                text NOT NULL DEFAULT 'new',
  assigned_to           uuid REFERENCES staff_members(id),
  assigned_name         text,
  first_contact_at      timestamptz DEFAULT now(),
  last_contact_at       timestamptz,
  next_follow_up_at     timestamptz,
  consultation_date     date,
  consultation_event_id uuid,
  retained_at           timestamptz,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE intake_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read intake leads"   ON intake_leads FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert intake leads" ON intake_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update intake leads" ON intake_leads FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete intake leads" ON intake_leads FOR DELETE TO anon USING (true);

-- ── Sample intake leads ───────────────────────────────────────────────────────

INSERT INTO intake_leads (full_name, phone, email, source, chapter_interest, status, assigned_to, assigned_name, notes)
SELECT 'Michael Torres','(312) 555-0198','mtorres@email.com','inbound',7,'consultation_scheduled',sm.id,sm.name,'Interested in Ch. 7. Wage garnishment issue.'
FROM staff_members sm WHERE sm.id = '11111111-0000-0000-0000-000000000004';

INSERT INTO intake_leads (full_name, phone, email, source, chapter_interest, status, assigned_to, assigned_name, notes)
SELECT 'Sandra Lee','(312) 555-0291','slee@email.com','referral',13,'new',sm.id,sm.name,'Referred by existing client. Behind on mortgage.'
FROM staff_members sm WHERE sm.id = '11111111-0000-0000-0000-000000000004';

INSERT INTO intake_leads (full_name, phone, email, source, chapter_interest, status, assigned_to, assigned_name, notes, next_follow_up_at)
SELECT 'Derek Washington','(773) 555-0344',null,'ad',7,'contacted',sm.id,sm.name,'Called in from Google Ad. Needs callback.',now() + interval '2 hours'
FROM staff_members sm WHERE sm.id = '11111111-0000-0000-0000-000000000004';

-- Sample intake calendar events (consultations today for Carlos Vega)
INSERT INTO calendar_events (title, calendar_type, event_subtype, department, staff_id, client_name, phone, start_time, end_time, status, spacing_buffer_minutes)
SELECT
  'Consultation — Michael Torres', 'intake', 'consultation', 'intake',
  sm.id, 'Michael Torres', '(312) 555-0198',
  (CURRENT_DATE + INTERVAL '10 hours')::timestamptz,
  (CURRENT_DATE + INTERVAL '10 hours 45 minutes')::timestamptz,
  'scheduled', 20
FROM staff_members sm WHERE sm.id = '11111111-0000-0000-0000-000000000004';

INSERT INTO calendar_events (title, calendar_type, event_subtype, department, staff_id, client_name, phone, start_time, end_time, status, spacing_buffer_minutes)
SELECT
  'Consultation — Sandra Lee', 'intake', 'consultation', 'intake',
  sm.id, 'Sandra Lee', '(312) 555-0291',
  (CURRENT_DATE + INTERVAL '11 hours 15 minutes')::timestamptz,
  (CURRENT_DATE + INTERVAL '12 hours')::timestamptz,
  'scheduled', 20
FROM staff_members sm WHERE sm.id = '11111111-0000-0000-0000-000000000004';

INSERT INTO calendar_events (title, calendar_type, event_subtype, department, staff_id, client_name, start_time, end_time, status, spacing_buffer_minutes)
SELECT
  'Follow-up Call — Derek Washington', 'intake', 'lead_follow_up', 'intake',
  sm.id, 'Derek Washington',
  (CURRENT_DATE + INTERVAL '14 hours')::timestamptz,
  (CURRENT_DATE + INTERVAL '14 hours 20 minutes')::timestamptz,
  'scheduled', 15
FROM staff_members sm WHERE sm.id = '11111111-0000-0000-0000-000000000004';
