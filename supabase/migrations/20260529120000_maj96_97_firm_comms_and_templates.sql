-- 20260529120000_maj96_97_firm_comms_and_templates.sql

-- ============================================================
-- MAJ-96: Per-firm email + SMS sender config
-- ============================================================
CREATE TABLE IF NOT EXISTS firm_communications_config (
  firm_id uuid PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  -- Email config
  email_from_name text,
  email_from_address text,
  email_reply_to text,
  email_domain text,
  email_domain_verified_at timestamptz,
  email_domain_dkim_records jsonb,
  email_domain_spf_records jsonb,
  -- SMS config
  sms_sender_name text,
  sms_from_number text,
  -- Reminder config
  reminder_cadence_days int[] DEFAULT ARRAY[7, 3, 1],
  reminders_enabled boolean DEFAULT true,
  -- Metadata
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE firm_communications_config ENABLE ROW LEVEL SECURITY;

-- Firm staff: read + write own firm's row
DROP POLICY IF EXISTS firm_comms_config_firm_staff ON firm_communications_config;
CREATE POLICY firm_comms_config_firm_staff
  ON firm_communications_config
  FOR ALL
  USING ( firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()) )
  WITH CHECK ( firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()) );

-- Super admin: all firms
DROP POLICY IF EXISTS firm_comms_config_super_admin ON firm_communications_config;
CREATE POLICY firm_comms_config_super_admin
  ON firm_communications_config
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

-- ============================================================
-- MAJ-97: Per-firm email template customization
-- ============================================================
CREATE TABLE IF NOT EXISTS firm_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (firm_id, template_key)
);

ALTER TABLE firm_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS firm_email_templates_firm_staff ON firm_email_templates;
CREATE POLICY firm_email_templates_firm_staff
  ON firm_email_templates
  FOR ALL
  USING ( firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()) )
  WITH CHECK ( firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()) );

DROP POLICY IF EXISTS firm_email_templates_super_admin ON firm_email_templates;
CREATE POLICY firm_email_templates_super_admin
  ON firm_email_templates
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
