/*
  # BAN-40 / BAN-35 — Firms (multi-tenant root) + platform-level user_profiles

  Pre-existing schema this migration relates to but does NOT replace:
    - staff_members.intake_portal_role: PIN-login role used by LegalAdminPortal
      (legal_admin / attorney / attorney_super_admin / super_admin). That role
      is local to the intake-portal PIN authentication scheme.
    - staff_members.role: free-text role label used by other portals.

  This migration adds the PLATFORM-level role scheme on top of Supabase auth
  (auth.users). user_profiles links auth.users to a firm and a platform_role.
  user_profiles.staff_member_id optionally back-references staff_members so a
  single person can have both a PIN login and a Supabase auth session.

  ## Firms (multi-tenant root)
  Required before per-firm row-level scoping can be enforced (a future PR).
*/

CREATE TABLE IF NOT EXISTS firms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  slug                text UNIQUE NOT NULL,
  status              text NOT NULL DEFAULT 'active'
    CHECK (status IN ('lead', 'trial', 'active', 'suspended', 'churned')),
  aws_storage_prefix  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firms_slug    ON firms(slug);
CREATE INDEX IF NOT EXISTS idx_firms_status  ON firms(status);

-- Seed Majors Law Group as the first firm. Stable id so user_profiles inserts
-- can reference it directly during bootstrap.
INSERT INTO firms (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Majors Law Group', 'mlg', 'active')
ON CONFLICT (id) DO NOTHING;

-- Platform role enum. ORDER MATTERS for any future ordinal-based comparisons.
DO $$ BEGIN
  CREATE TYPE platform_role AS ENUM (
    'super_admin_bankruptcy_ai',  -- platform owner — full cross-firm access
    'firm_super_admin',           -- firm owner / managing attorney
    'attorney',                   -- licensed attorney within firm
    'legal_admin',                -- non-attorney legal staff
    'intake',                     -- intake-only staff
    'accounting',                 -- accounting / billing staff
    'client'                      -- end client
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id          uuid REFERENCES firms(id),
  role             platform_role NOT NULL DEFAULT 'client',
  full_name        text,
  staff_member_id  uuid REFERENCES staff_members(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_firm  ON user_profiles(firm_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role  ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_staff ON user_profiles(staff_member_id);

ALTER TABLE firms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;

-- Permissive policies for now; tighten in a follow-up once auth flow lands.
CREATE POLICY "Anon can read firms"          ON firms         FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read user_profiles"  ON user_profiles FOR SELECT TO anon USING (true);
