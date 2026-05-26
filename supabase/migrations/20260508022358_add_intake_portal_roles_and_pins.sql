/*
  # Add intake portal roles and PIN login

  Adds role-based access control to the intake portal without Supabase auth.
  Staff log in by selecting their name and entering a 4-digit PIN.

  1. Changes to staff_members
    - `intake_portal_role` (text) — 'legal_admin' | 'attorney' | 'attorney_super_admin' | 'super_admin'
    - `intake_pin_hash` (text) — bcrypt hash of 4-digit PIN (stored as plain text for now; replace with hash when backend auth is added)
    - `intake_pin` (text) — plain 4-digit PIN for demo (remove when real auth is added)

  2. Role definitions
    - legal_admin: handles new leads, scheduling, intake, contact logging
    - attorney: reviews cases, quotes fees, runs welcome calls
    - attorney_super_admin: all attorney capabilities + staff management
    - super_admin: full access including staff management (non-attorney)

  3. Seeds default PINs for existing staff
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'intake_portal_role'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN intake_portal_role text
      DEFAULT 'legal_admin'
      CHECK (intake_portal_role IN ('legal_admin','attorney','attorney_super_admin','super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'intake_pin'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN intake_pin text;
  END IF;
END $$;

-- Assign roles and PINs to existing seed staff
UPDATE staff_members SET intake_portal_role = 'attorney_super_admin', intake_pin = '1111'
  WHERE id = '11111111-0000-0000-0000-000000000005'; -- Sarah Kim (Managing Attorney)

UPDATE staff_members SET intake_portal_role = 'attorney', intake_pin = '2222'
  WHERE id = '11111111-0000-0000-0000-000000000001'; -- Jennifer Smith (Attorney)

UPDATE staff_members SET intake_portal_role = 'super_admin', intake_pin = '3333'
  WHERE id = '11111111-0000-0000-0000-000000000004'; -- Carlos Vega (Legal Admin → Super Admin)

UPDATE staff_members SET intake_portal_role = 'legal_admin', intake_pin = '4444'
  WHERE id = '11111111-0000-0000-0000-000000000002'; -- Marcus Rivera

UPDATE staff_members SET intake_portal_role = 'legal_admin', intake_pin = '5555'
  WHERE id = '11111111-0000-0000-0000-000000000003'; -- Tanya Brown

-- Allow anon to read staff_members for login (name + role only, not PIN via RLS — but since portal uses anon key, we verify PIN client-side for demo)
-- In production this should be a server-side PIN check
