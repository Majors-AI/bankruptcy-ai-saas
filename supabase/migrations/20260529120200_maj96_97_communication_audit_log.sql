-- 20260529120200_maj96_97_communication_audit_log.sql
-- Audit trail for which template + sender identity each client message used.

CREATE TABLE communication_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) ON DELETE CASCADE,
  recipient text,
  template_key text,
  channel text,
  template_source text,   -- firm_custom | system_default
  sender_identity text,   -- bai_default | firm_reply_to | firm_domain
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE communication_audit_log ENABLE ROW LEVEL SECURITY;

-- Inserts come from the edge function via the service-role key, which bypasses
-- RLS, so no INSERT policy is needed. These policies cover reads only.

CREATE POLICY comm_audit_firm_staff_read
  ON communication_audit_log
  FOR SELECT
  USING ( firm_id = (SELECT firm_id FROM user_profiles WHERE id = auth.uid()) );

CREATE POLICY comm_audit_super_admin_read
  ON communication_audit_log
  FOR SELECT
  USING ( is_bankruptcy_ai_super_admin() );
