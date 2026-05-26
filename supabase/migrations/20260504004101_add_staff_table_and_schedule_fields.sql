/*
  # Staff Table and Schedule Date Fields

  ## New Table: firm_staff
  Stores staff members who can be assigned to cases, log time entries, and
  be selected in dropdowns throughout the portal.

  ### Columns
  - `id` (uuid PK)
  - `full_name` (text) — display name
  - `email` (text) — work email
  - `phone` (text) — work phone
  - `role` (text) — staff role: attorney | paralegal | accounting | admin | receptionist
  - `is_active` (boolean) — soft delete
  - `created_at` (timestamptz)

  ## Changes to accounting_fee_structures
  - `semi_monthly_day_1` (integer) — first day of month for semi-monthly payments (e.g. 1 or 5)
  - `semi_monthly_day_2` (integer) — second day of month for semi-monthly payments (e.g. 15 or 20)
  - `biweekly_start_date` (date) — anchor date for bi-weekly calculations

  ## Security
  - RLS enabled on firm_staff with open anon access (same pattern as other tables)
*/

-- ── firm_staff ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firm_staff (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  text NOT NULL,
  email      text,
  phone      text,
  role       text NOT NULL DEFAULT 'admin',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE firm_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read firm_staff"
  ON firm_staff FOR SELECT TO anon USING (true);

CREATE POLICY "Staff can insert firm_staff"
  ON firm_staff FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Staff can update firm_staff"
  ON firm_staff FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Semi-monthly and bi-weekly schedule fields ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'semi_monthly_day_1'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN semi_monthly_day_1 integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'semi_monthly_day_2'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN semi_monthly_day_2 integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_fee_structures' AND column_name = 'biweekly_start_date'
  ) THEN
    ALTER TABLE accounting_fee_structures ADD COLUMN biweekly_start_date date;
  END IF;
END $$;

-- ── Seed demo staff ───────────────────────────────────────────────────────────
INSERT INTO firm_staff (full_name, email, phone, role) VALUES
  ('Maria Garcia',   'mgarcia@majorslaw.com',  '(602) 555-0100', 'paralegal'),
  ('James Thompson', 'jthompson@majorslaw.com', '(602) 555-0101', 'attorney'),
  ('Sarah Lee',      'slee@majorslaw.com',      '(602) 555-0102', 'paralegal'),
  ('David Reeves',   'dreeves@majorslaw.com',   '(602) 555-0103', 'accounting'),
  ('Lisa Chen',      'lchen@majorslaw.com',     '(602) 555-0104', 'admin')
ON CONFLICT DO NOTHING;
