/*
  # Staff Sick Status & Day Overrides

  ## Summary
  Adds a lightweight sick/out-of-office tracking system so that when a staff
  member marks themselves as sick (or an admin marks someone out), the scheduling
  system automatically skips that person for the day.

  ## New Tables

  ### `staff_sick_overrides`
  One row per staff-member-per-date when they are marked out sick or out of office.
  - `id` — primary key
  - `staff_id` — references staff_members
  - `staff_name` — denormalized display name
  - `date` — the date they are out (defaults to today)
  - `reason` — "sick" | "emergency" | "other"
  - `notes` — optional free-text
  - `marked_by` — name/role of who created the record
  - `is_active` — soft-flag; set false to cancel without deleting
  - `created_at`

  ## Notes
  - RLS is enabled; anon key has insert/select/update access so the portal can
    function without full auth (existing pattern in this project).
  - The scheduling bot and intake calendar should filter out staff who have an
    active sick override for today before assigning consultations.
*/

CREATE TABLE IF NOT EXISTS staff_sick_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL,
  staff_name   text NOT NULL,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  reason       text NOT NULL DEFAULT 'sick',
  notes        text,
  marked_by    text NOT NULL DEFAULT 'self',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE staff_sick_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read sick overrides"
  ON staff_sick_overrides FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert sick overrides"
  ON staff_sick_overrides FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update sick overrides"
  ON staff_sick_overrides FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sick_overrides_date_active
  ON staff_sick_overrides (date, is_active);
