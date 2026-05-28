/*
  # MAJ-92 — Trustee 341 Document Checklist

  Platform-level default checklist + per-firm customization table + per-request
  manual completion state.

  Tables:
    - trustee_doc_checklist_defaults   : 6 platform-default 341 docs (immutable platform seed)
    - firm_trustee_doc_checklist       : per-firm copy, seeded from defaults on onboarding;
                                         firms can add/edit/toggle/remove items
    - trustee_341_checklist_state      : per-request per-item manual completion + notes
                                         (staff override on top of auto-detection from
                                         client_documents phase=07-trustee)

  On launch: MLG (id=000...001) and Neeley (id=000...002) both seeded with all 6 defaults.

  Depends on:
    - firms                        (from 20260527020000_firms_and_user_profiles.sql)
    - user_profiles                (from 20260527020000_firms_and_user_profiles.sql)
    - trustee_document_requests    (from pre-20260505163143 trustee portal migrations)
    - auth.users                   (Supabase auth)
*/

-- ─── Platform defaults (read-only reference; firms copy from here) ─────────────

CREATE TABLE IF NOT EXISTS trustee_doc_checklist_defaults (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type            text UNIQUE NOT NULL,
  display_label       text NOT NULL,
  description         text,
  required            boolean NOT NULL DEFAULT true,
  applies_to          text CHECK (applies_to IN ('debtor_only', 'codebtor_only', 'both', 'either')),
  expected_count_min  int NOT NULL DEFAULT 1,
  expected_count_max  int,
  category            text,
  sort_order          int NOT NULL DEFAULT 100
);

ALTER TABLE trustee_doc_checklist_defaults ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trustee_doc_checklist_defaults' AND policyname = 'Anon can read checklist defaults') THEN
    EXECUTE 'CREATE POLICY "Anon can read checklist defaults" ON trustee_doc_checklist_defaults FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trustee_doc_checklist_defaults' AND policyname = 'Auth can read checklist defaults') THEN
    EXECUTE 'CREATE POLICY "Auth can read checklist defaults" ON trustee_doc_checklist_defaults FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

INSERT INTO trustee_doc_checklist_defaults
  (doc_type, display_label, description, required, applies_to, expected_count_min, category, sort_order)
VALUES
  ('drivers_license',        'Driver''s License',                       'Government-issued photo ID',                                      true,  'both',   1, 'identity',  10),
  ('social_security_card',   'Social Security Card',                    'Or W-2 / 1099 showing full SSN',                                  true,  'both',   1, 'identity',  20),
  ('bank_statements_90day',  'Bank Statements (90 days)',               'All accounts, all statements covering past 90 days',               true,  'either', 3, 'financial', 30),
  ('tax_return_year1',       'Federal Tax Return — Most Recent Year',   'Including all schedules and W-2s',                                true,  'either', 1, 'tax',       40),
  ('tax_return_year2',       'Federal Tax Return — Prior Year',         'Including all schedules and W-2s',                                true,  'either', 1, 'tax',       50),
  ('paystubs_90day',         'Paystubs (90 days)',                      'All employers, covering past 90 days',                            true,  'either', 6, 'income',    60)
ON CONFLICT (doc_type) DO NOTHING;

-- ─── Per-firm checklist (seeded from defaults; firms can customise) ───────────

CREATE TABLE IF NOT EXISTS firm_trustee_doc_checklist (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  doc_type            text NOT NULL,
  display_label       text NOT NULL,
  description         text,
  required            boolean NOT NULL DEFAULT true,
  applies_to          text CHECK (applies_to IN ('debtor_only', 'codebtor_only', 'both', 'either', NULL)),
  expected_count_min  int NOT NULL DEFAULT 1,
  expected_count_max  int,
  category            text,
  sort_order          int NOT NULL DEFAULT 100,
  is_active           boolean NOT NULL DEFAULT true,
  added_by            uuid REFERENCES auth.users(id),
  added_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_firm_checklist_firm
  ON firm_trustee_doc_checklist(firm_id, is_active, sort_order);

ALTER TABLE firm_trustee_doc_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_checklist_super_admin_all ON firm_trustee_doc_checklist
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

CREATE POLICY firm_checklist_firm_all ON firm_trustee_doc_checklist
  FOR ALL
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

-- Anon read so the TrusteeDocumentPortal (which uses anon key for reads) can load it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'firm_trustee_doc_checklist' AND policyname = 'Anon can read firm checklist') THEN
    EXECUTE 'CREATE POLICY "Anon can read firm checklist" ON firm_trustee_doc_checklist FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- ─── Per-request manual completion state ─────────────────────────────────────
-- Tracks staff overrides on top of auto-detection from client_documents.
-- One row per (request, doc_type); upserted when staff toggles an item.

CREATE TABLE IF NOT EXISTS trustee_341_checklist_state (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES trustee_document_requests(id) ON DELETE CASCADE,
  firm_id         uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  doc_type        text NOT NULL,
  completed       boolean NOT NULL DEFAULT false,
  completed_at    timestamptz,
  completed_by    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_341_state_request
  ON trustee_341_checklist_state(request_id);

CREATE INDEX IF NOT EXISTS idx_341_state_firm
  ON trustee_341_checklist_state(firm_id);

ALTER TABLE trustee_341_checklist_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_state_super_admin_all ON trustee_341_checklist_state
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

CREATE POLICY checklist_state_firm_all ON trustee_341_checklist_state
  FOR ALL
  USING (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    firm_id = (SELECT firm_id FROM user_profiles WHERE user_profiles.user_id = auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trustee_341_checklist_state' AND policyname = 'Anon can read checklist state') THEN
    EXECUTE 'CREATE POLICY "Anon can read checklist state" ON trustee_341_checklist_state FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trustee_341_checklist_state' AND policyname = 'Anon can write checklist state') THEN
    EXECUTE 'CREATE POLICY "Anon can write checklist state" ON trustee_341_checklist_state FOR ALL TO anon USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── Seed both V1 pilot firms with platform defaults ─────────────────────────
-- MLG: 00000000-0000-0000-0000-000000000001
-- Neeley: 00000000-0000-0000-0000-000000000002

INSERT INTO firm_trustee_doc_checklist
  (firm_id, doc_type, display_label, description, required, applies_to,
   expected_count_min, expected_count_max, category, sort_order, is_active)
SELECT
  f.firm_id,
  d.doc_type, d.display_label, d.description, d.required, d.applies_to,
  d.expected_count_min, d.expected_count_max, d.category, d.sort_order, true
FROM trustee_doc_checklist_defaults d
CROSS JOIN (
  VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),
    ('00000000-0000-0000-0000-000000000002'::uuid)
) AS f(firm_id)
ON CONFLICT (firm_id, doc_type) DO NOTHING;
