/*
  # MAJ-118 — Client Registration: Disclosures, Consents, Signature, FCRA Audit

  Adds per-product Plaid consent columns, joint-filing signature block,
  firm scoping, IP capture column, and a firm-staff SELECT policy to
  client_registrations.

  Ghost columns for credit-pull consent already exist from
  20260513184205_create_client_registrations_table.sql:
    consented_isoftpull, consented_isoftpull_fcra, opt_in_isoftpull,
    isoftpull_consent_timestamp
  — these are reused; not re-added here.

  Uses ADD COLUMN IF NOT EXISTS on every new column so this migration is
  idempotent against any partially-applied state.
*/

-- ── General consent columns written by existing component ────────────────────
-- Added here in case they were never applied to the live DB.
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS consented_data_retention boolean NOT NULL DEFAULT false;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS consented_ai_disclosure  boolean NOT NULL DEFAULT false;

-- ── Plaid per-product consent (replaces the old blanket opt_in_plaid) ────────
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS opt_in_plaid_bank       boolean NOT NULL DEFAULT false;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS opt_in_plaid_payroll    boolean NOT NULL DEFAULT false;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS consented_plaid_bank    boolean NOT NULL DEFAULT false;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS consented_plaid_payroll boolean NOT NULL DEFAULT false;

-- ── Firm scoping ─────────────────────────────────────────────────────────────
-- TODO: assumes one deployment per firm; if firms ever share a deployment this
--       is wrong and needs a per-client firm association.
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES firms(id);
CREATE INDEX IF NOT EXISTS idx_client_registrations_firm_id ON client_registrations(firm_id);

-- ── Signature block — Debtor 1 ───────────────────────────────────────────────
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS signer_full_name    text;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS signer_printed_name text;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS signature_timestamp  timestamptz;

-- ── Joint filing — Debtor 2 ──────────────────────────────────────────────────
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS is_joint_filing             boolean NOT NULL DEFAULT false;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS debtor2_full_name           text;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS debtor2_printed_name        text;
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS debtor2_signature_timestamp timestamptz;

-- ── Audit / versioning ───────────────────────────────────────────────────────
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS disclosure_version text NOT NULL DEFAULT 'v1.0';
ALTER TABLE client_registrations ADD COLUMN IF NOT EXISTS ip_address         text;

-- ── Firm-staff SELECT policy ─────────────────────────────────────────────────
-- Allows attorneys, legal admins, firm super admins, and platform super admins
-- to read all client_registration records belonging to their firm.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_registrations'
      AND policyname = 'Firm staff can select registrations for their firm'
  ) THEN
    CREATE POLICY "Firm staff can select registrations for their firm"
      ON client_registrations FOR SELECT
      TO authenticated
      USING (
        firm_id IS NOT NULL
        AND firm_id = (
          SELECT up.firm_id FROM user_profiles up WHERE up.user_id = auth.uid()
        )
        AND (
          SELECT up.role::text FROM user_profiles up WHERE up.user_id = auth.uid()
        ) IN ('attorney', 'legal_admin', 'firm_super_admin', 'super_admin_bankruptcy_ai')
      );
  END IF;
END $$;
