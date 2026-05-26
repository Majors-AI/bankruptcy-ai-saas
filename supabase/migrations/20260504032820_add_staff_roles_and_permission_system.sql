/*
  # Staff Role & Permission System

  ## Overview
  Upgrades the staff_members table to support the full role hierarchy for MAJORSLAW.ai:

  ## Role Hierarchy (highest to lowest authority)
  1. attorney_owner       — Supreme authority; can remove anyone; no restrictions
  2. attorney_superadmin  — Super attorney; needs owner permission to remove other users
  3. accounting_superadmin — Accounting lead; needs owner permission to remove users
  4. attorney             — Standard attorney
  5. accounting_admin     — Standard accounting staff
  6. legal_admin          — Intake / front desk
  7. paralegal            — Paralegal staff
  8. custom               — Custom role (must be approved by any superadmin or owner)

  ## New Tables
  - `staff_removal_requests` — when a superadmin wants to remove a user, creates a request
    that must be approved by owner before executing
  - `staff_role_approvals`   — tracks approval of custom role requests

  ## Changes to staff_members
  - Adds `role_level` integer column (1=owner, 8=custom) for easy permission comparisons
  - Adds `custom_role_name` text for custom roles
  - Adds `custom_role_approved` boolean
  - Adds `custom_role_approved_by` text
  - Adds `phone` text column
  - Adds `title` text (display title, e.g., "Lead Paralegal")
  - Adds `updated_at` timestamptz
  - Updates existing role values to new system
*/

-- ── Extend staff_members ─────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='role_level') THEN
    ALTER TABLE staff_members ADD COLUMN role_level integer NOT NULL DEFAULT 7;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='custom_role_name') THEN
    ALTER TABLE staff_members ADD COLUMN custom_role_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='custom_role_approved') THEN
    ALTER TABLE staff_members ADD COLUMN custom_role_approved boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='custom_role_approved_by') THEN
    ALTER TABLE staff_members ADD COLUMN custom_role_approved_by text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='phone') THEN
    ALTER TABLE staff_members ADD COLUMN phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='title') THEN
    ALTER TABLE staff_members ADD COLUMN title text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='updated_at') THEN
    ALTER TABLE staff_members ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='notes') THEN
    ALTER TABLE staff_members ADD COLUMN notes text;
  END IF;
END $$;

-- Migrate existing roles to new role values
UPDATE staff_members SET role = 'attorney_owner', role_level = 1 WHERE role = 'admin' AND id = '11111111-0000-0000-0000-000000000005';
UPDATE staff_members SET role = 'attorney', role_level = 4 WHERE role = 'attorney';
UPDATE staff_members SET role = 'paralegal', role_level = 7 WHERE role = 'paralegal';
UPDATE staff_members SET role = 'legal_admin', role_level = 6 WHERE role = 'intake_staff';

-- ── staff_removal_requests ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_removal_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     uuid NOT NULL REFERENCES staff_members(id),
  requester_name   text NOT NULL,
  target_id        uuid NOT NULL REFERENCES staff_members(id),
  target_name      text NOT NULL,
  reason           text,
  status           text NOT NULL DEFAULT 'pending_owner_approval',
  -- pending_owner_approval | approved | denied | executed
  owner_notified_at timestamptz DEFAULT now(),
  reviewed_by      text,
  reviewed_at      timestamptz,
  review_notes     text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE staff_removal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read removal requests"
  ON staff_removal_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert removal requests"
  ON staff_removal_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update removal requests"
  ON staff_removal_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon access (app uses anon key in demo)
CREATE POLICY "Anon can read removal requests"
  ON staff_removal_requests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert removal requests"
  ON staff_removal_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update removal requests"
  ON staff_removal_requests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ── staff_role_approvals ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_role_approvals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       uuid NOT NULL REFERENCES staff_members(id),
  staff_name     text NOT NULL,
  custom_role    text NOT NULL,
  requested_by   text,
  status         text NOT NULL DEFAULT 'pending',
  -- pending | approved | denied
  reviewed_by    text,
  reviewed_at    timestamptz,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE staff_role_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read role approvals"
  ON staff_role_approvals FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert role approvals"
  ON staff_role_approvals FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update role approvals"
  ON staff_role_approvals FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Anon RLS on staff_members (needed since app uses anon key) ───────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_members' AND policyname = 'Anon can read staff members'
  ) THEN
    CREATE POLICY "Anon can read staff members"
      ON staff_members FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_members' AND policyname = 'Anon can insert staff members'
  ) THEN
    CREATE POLICY "Anon can insert staff members"
      ON staff_members FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_members' AND policyname = 'Anon can update staff members'
  ) THEN
    CREATE POLICY "Anon can update staff members"
      ON staff_members FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_members' AND policyname = 'Anon can delete staff members'
  ) THEN
    CREATE POLICY "Anon can delete staff members"
      ON staff_members FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Set Sarah Kim (current admin) as attorney_owner with level 1
UPDATE staff_members SET role = 'attorney_owner', role_level = 1, title = 'Managing Attorney' WHERE id = '11111111-0000-0000-0000-000000000005';
UPDATE staff_members SET role = 'attorney', role_level = 4, title = 'Associate Attorney' WHERE id = '11111111-0000-0000-0000-000000000001';
UPDATE staff_members SET role = 'paralegal', role_level = 7 WHERE id IN ('11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003');
UPDATE staff_members SET role = 'legal_admin', role_level = 6 WHERE id = '11111111-0000-0000-0000-000000000004';
