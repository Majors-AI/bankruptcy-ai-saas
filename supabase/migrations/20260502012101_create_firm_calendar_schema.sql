/*
  # Firm Calendar Schema

  ## Purpose
  Full calendar system for a bankruptcy law firm supporting:
  - Intake appointments (5/hour max)
  - Paralegal doc review appointments (4/hour max)
  - Attorney signing appointments (client self-schedule after permission granted)
  - Court calendar (341 hearings, other hearings, deadlines)
  - Staff availability, PTO requests/approval, sick-day handling

  ## Tables
  1. `staff_members` — firm staff with roles and capacity settings
  2. `staff_availability` — weekly recurring availability windows per staff member
  3. `pto_requests` — PTO requests with admin approval workflow
  4. `sick_reports` — same-day sick reports with coverage check
  5. `calendar_events` — all appointments and court events
  6. `appointment_slots` — generated available slots for client self-scheduling
  7. `filing_fee_payments` — tracks when client has paid court filing fee (gates signing scheduling)
  8. `signing_permissions` — attorney grants permission for client to schedule signing

  ## Security
  - RLS enabled on all tables
  - Open anon policies for demo (no auth system yet)
*/

-- ─── Staff Members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'paralegal',
  -- roles: 'admin' | 'attorney' | 'paralegal' | 'intake_staff' | 'accounting'
  color         text NOT NULL DEFAULT '#6366f1',
  -- hex color used on calendar for this staff member's events
  is_active     boolean NOT NULL DEFAULT true,
  max_intake_per_hour     integer NOT NULL DEFAULT 5,
  max_doc_review_per_hour integer NOT NULL DEFAULT 4,
  max_signing_per_hour    integer NOT NULL DEFAULT 2,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_members_select" ON staff_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff_members_insert" ON staff_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff_members_update" ON staff_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed demo staff
INSERT INTO staff_members (id, name, email, role, color) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Jennifer Smith', 'jsmith@majorslaw.ai', 'attorney', '#f59e0b'),
  ('11111111-0000-0000-0000-000000000002', 'Marcus Rivera', 'mrivera@majorslaw.ai', 'paralegal', '#3b82f6'),
  ('11111111-0000-0000-0000-000000000003', 'Tanya Brown', 'tbrown@majorslaw.ai', 'paralegal', '#10b981'),
  ('11111111-0000-0000-0000-000000000004', 'Carlos Vega', 'cvega@majorslaw.ai', 'intake_staff', '#8b5cf6'),
  ('11111111-0000-0000-0000-000000000005', 'Sarah Kim', 'skim@majorslaw.ai', 'admin', '#ef4444')
ON CONFLICT (id) DO NOTHING;

-- ─── Staff Availability (weekly recurring) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL, -- 0=Sun, 1=Mon ... 6=Sat
  start_time  time NOT NULL,    -- e.g. 08:00
  end_time    time NOT NULL,    -- e.g. 17:00
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, day_of_week)
);

ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_avail_all" ON staff_availability FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed default M-F 8am-5pm availability for all staff
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time)
SELECT s.id, d.day, '08:00'::time, '17:00'::time
FROM staff_members s
CROSS JOIN (SELECT unnest(ARRAY[1,2,3,4,5]) AS day) d
ON CONFLICT (staff_id, day_of_week) DO NOTHING;

-- ─── PTO Requests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pto_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  reason        text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'approved' | 'denied'
  approved_by   uuid REFERENCES staff_members(id),
  approved_at   timestamptz,
  denial_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pto_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pto_all" ON pto_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── Sick Reports ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sick_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  report_date     date NOT NULL DEFAULT CURRENT_DATE,
  reported_at     timestamptz NOT NULL DEFAULT now(),
  coverage_status text NOT NULL DEFAULT 'checking',
  -- 'checking' | 'adequate' | 'rescheduled'
  affected_appt_count  integer NOT NULL DEFAULT 0,
  rescheduled_count    integer NOT NULL DEFAULT 0,
  notes           text,
  resolved_by     uuid REFERENCES staff_members(id)
);

ALTER TABLE sick_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sick_all" ON sick_reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── Calendar Events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_type   text NOT NULL DEFAULT 'intake',
  -- 'intake' | 'doc_review' | 'signing' | 'court_hearing' | 'court_deadline'
  title           text NOT NULL DEFAULT '',
  description     text,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  all_day         boolean NOT NULL DEFAULT false,
  -- Staff / resources
  staff_id        uuid REFERENCES staff_members(id),
  -- Client info
  client_id       text,
  client_name     text,
  client_phone    text,
  client_email    text,
  case_number     text,
  -- Court-specific
  court_location  text,
  judge_name      text,
  courtroom       text,
  trustee_name    text,
  -- Status
  status          text NOT NULL DEFAULT 'scheduled',
  -- 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'
  cancellation_reason text,
  rescheduled_to  uuid REFERENCES calendar_events(id),
  -- Signing gate flags
  requires_filing_fee_paid boolean NOT NULL DEFAULT false,
  filing_fee_paid boolean NOT NULL DEFAULT false,
  -- Meta
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_events_start    ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_cal_events_type     ON calendar_events(calendar_type);
CREATE INDEX IF NOT EXISTS idx_cal_events_staff    ON calendar_events(staff_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_client   ON calendar_events(client_id);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cal_events_select" ON calendar_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cal_events_insert" ON calendar_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "cal_events_update" ON calendar_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cal_events_delete" ON calendar_events FOR DELETE TO anon, authenticated USING (true);

-- Seed demo events for the current week
INSERT INTO calendar_events (calendar_type, title, start_time, end_time, client_name, status, case_number, court_location, trustee_name) VALUES
  ('intake',        'Intake — James & Patricia Ford',    (CURRENT_DATE + interval '1 day' + interval '9 hours')::timestamptz,  (CURRENT_DATE + interval '1 day' + interval '10 hours')::timestamptz, 'James Ford',      'scheduled', NULL, NULL, NULL),
  ('intake',        'Intake — Maria Gonzalez',           (CURRENT_DATE + interval '1 day' + interval '9 hours')::timestamptz,  (CURRENT_DATE + interval '1 day' + interval '10 hours')::timestamptz, 'Maria Gonzalez',  'scheduled', NULL, NULL, NULL),
  ('intake',        'Intake — Robert & Linda Hayes',     (CURRENT_DATE + interval '1 day' + interval '10 hours')::timestamptz, (CURRENT_DATE + interval '1 day' + interval '11 hours')::timestamptz, 'Robert Hayes',    'confirmed', NULL, NULL, NULL),
  ('doc_review',    'Doc Review — Jane Sample',          (CURRENT_DATE + interval '2 days' + interval '11 hours')::timestamptz,(CURRENT_DATE + interval '2 days' + interval '12 hours')::timestamptz, 'Jane Sample',     'confirmed', 'Pending', NULL, NULL),
  ('doc_review',    'Doc Review — Maria Gonzalez',       (CURRENT_DATE + interval '2 days' + interval '14 hours')::timestamptz,(CURRENT_DATE + interval '2 days' + interval '15 hours')::timestamptz, 'Maria Gonzalez',  'scheduled', NULL, NULL, NULL),
  ('signing',       'Signing Appt — Robert Hayes',       (CURRENT_DATE + interval '4 days' + interval '10 hours')::timestamptz,(CURRENT_DATE + interval '4 days' + interval '11 hours')::timestamptz, 'Robert Hayes',    'scheduled', 'Pending', NULL, NULL),
  ('court_hearing', '341 Meeting — Patterson',           (CURRENT_DATE + interval '7 days' + interval '9 hours')::timestamptz, (CURRENT_DATE + interval '7 days' + interval '10 hours')::timestamptz, 'William Patterson','scheduled','24-12345', 'US Bankruptcy Court, N.D. Texas', 'Robert Martinez'),
  ('court_hearing', '341 Meeting — Johnson',             (CURRENT_DATE + interval '7 days' + interval '10 hours')::timestamptz,(CURRENT_DATE + interval '7 days' + interval '11 hours')::timestamptz, 'Diane Johnson',   'scheduled', '24-12301', 'US Bankruptcy Court, N.D. Texas', 'Robert Martinez'),
  ('court_deadline','Amended Schedule Deadline — Sample',(CURRENT_DATE + interval '5 days')::timestamptz,                     (CURRENT_DATE + interval '5 days')::timestamptz,                      'Jane Sample',     'scheduled', 'Pending', NULL, NULL),
  ('court_deadline','Trustee Deadline — Patterson',      (CURRENT_DATE + interval '9 days')::timestamptz,                     (CURRENT_DATE + interval '9 days')::timestamptz,                      'William Patterson','scheduled','24-12345', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ─── Filing Fee Payments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS filing_fee_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     text NOT NULL DEFAULT '',
  amount_paid   numeric(10,2) NOT NULL DEFAULT 0,
  payment_date  date NOT NULL DEFAULT CURRENT_DATE,
  payment_ref   text,
  logged_by     uuid REFERENCES staff_members(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE filing_fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "filing_fee_all" ON filing_fee_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── Signing Permissions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signing_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       text NOT NULL DEFAULT '',
  client_name     text NOT NULL DEFAULT '',
  granted_by      uuid REFERENCES staff_members(id),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  attorney_review_complete boolean NOT NULL DEFAULT false,
  filing_fee_paid          boolean NOT NULL DEFAULT false,
  can_schedule    boolean NOT NULL DEFAULT false,
  expires_at      timestamptz,
  scheduled_event_id uuid REFERENCES calendar_events(id)
);

ALTER TABLE signing_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signing_perm_all" ON signing_permissions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
