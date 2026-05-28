/*
  # V1 — One-click client file ZIP export

  Tracks ZIP generation jobs. The edge function generate-client-zip writes
  to this table at start (requested_at) and again at completion
  (completed_at, storage_path, expires_at, file_count, total_size_bytes,
  manifest_csv).

  Expires_at is set to 24 hours after generation. zip-export-cleanup-cron
  runs daily and deletes any storage object whose expires_at has passed,
  then nulls out storage_path on the log row (we keep the audit row for
  history but stop holding the bytes).

  Depends on:
    - clients       (from 20260527010000_create_clients_table.sql)
    - firms         (from 20260527020000_firms_and_user_profiles.sql)
    - user_profiles (from 20260527020000_firms_and_user_profiles.sql)
    - auth.users
*/

CREATE TABLE IF NOT EXISTS client_zip_exports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid REFERENCES clients(id) ON DELETE CASCADE,
  firm_id               uuid REFERENCES firms(id),
  requested_at          timestamptz NOT NULL DEFAULT now(),
  requested_by          uuid REFERENCES auth.users(id),
  completed_at          timestamptz,
  storage_path          text,
  expires_at            timestamptz,
  download_count        integer NOT NULL DEFAULT 0,
  last_downloaded_at    timestamptz,
  file_count            integer,
  total_size_bytes      bigint,
  manifest_csv          text,
  error                 text
);

CREATE INDEX IF NOT EXISTS idx_zip_exports_client
  ON client_zip_exports(client_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_zip_exports_expires
  ON client_zip_exports(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE client_zip_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_zip_exports_super_admin_all ON client_zip_exports
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

CREATE POLICY client_zip_exports_firm_all ON client_zip_exports
  FOR ALL
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );
