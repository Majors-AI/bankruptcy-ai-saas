/*
  # MAJ-95 (V1.1) — Per-firm branding

  Stores per-firm visual identity: logo URLs, color palette, portal display
  names, and client-facing messages.

  Uses Linear spec columns exactly:
    - logo_url / logo_small_url  : full and thumbnail logo
    - primary_color / accent_color : hex codes for portal CSS vars
    - display_name / short_name   : shown in client portal header
    - client_portal_welcome_message / client_portal_footer_message
    - updated_by: audit trail (no separate history table in V1.1 phase 1)

  RLS:
    - Anon read: allowed (client portal reads branding without auth session)
    - Firm staff: read + write their own firm's row
    - Super admin: all access

  Depends on:
    - firms        (from 20260527020000_firms_and_user_profiles.sql)
    - user_profiles (from 20260527020000_firms_and_user_profiles.sql)
    - auth.users   (Supabase auth)
*/

CREATE TABLE IF NOT EXISTS firm_branding (
  firm_id                        uuid PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  logo_url                       text,
  logo_small_url                 text,
  primary_color                  text,
  accent_color                   text,
  display_name                   text,
  short_name                     text,
  client_portal_welcome_message  text,
  client_portal_footer_message   text,
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  updated_by                     uuid REFERENCES auth.users(id)
);

ALTER TABLE firm_branding ENABLE ROW LEVEL SECURITY;

-- Anon: read-only (client portal loads branding without a session)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'firm_branding' AND policyname = 'Anon can read firm branding') THEN
    EXECUTE 'CREATE POLICY "Anon can read firm branding" ON firm_branding FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- Super admin: full cross-firm access
CREATE POLICY firm_branding_super_admin_all ON firm_branding
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'super_admin_bankruptcy_ai'
    )
  );

-- Firm staff: read + write their own firm's branding row
CREATE POLICY firm_branding_firm_all ON firm_branding
  FOR ALL
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- ─── Seed V1 pilot firms ──────────────────────────────────────────────────────

INSERT INTO firm_branding (firm_id, display_name, short_name, primary_color, accent_color,
  client_portal_welcome_message, client_portal_footer_message)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',  -- Majors Law Group
    'Majors Law Group',
    'MLG',
    '#f59e0b',  -- amber-400
    '#1e40af',  -- blue-800
    'Welcome to your bankruptcy case portal. Our team is here to guide you through every step. If you have questions, use the "Ask a Question" button at any time.',
    'Questions? Contact Majors Law Group at your intake phone number or through the portal messaging system.'
  ),
  (
    '00000000-0000-0000-0000-000000000002',  -- Neeley Law Firm
    'Neeley Law Firm',
    'Neeley',
    '#10b981',  -- emerald-500
    '#1e293b',  -- slate-800
    'Welcome to your client portal. We are committed to guiding you through this process with care and transparency.',
    'Questions? Reach your Neeley Law Firm legal team through the portal messaging system.'
  )
ON CONFLICT (firm_id) DO NOTHING;
