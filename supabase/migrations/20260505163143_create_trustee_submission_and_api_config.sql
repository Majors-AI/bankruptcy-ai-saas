/*
  # Trustee Portal Submissions, API Config, and Priority Escalation

  1. New Tables
    - trustee_api_configs: per-trustee portal API credentials and submission config
    - trustee_portal_submissions: log of each document submission sent to a trustee portal
    - trustee_paralegal_reviews: paralegal review queue entries (one per request)
    - trustee_paralegal_review_items: per-document paralegal sign-off

  2. Changes to trustee_document_requests
    - Add paralegal_review_status: pending | in_review | approved | rejected
    - Add paralegal_reviewed_by, paralegal_reviewed_at
    - Add submitted_to_trustee_at, trustee_submission_id
    - Add priority_level: normal | elevated | critical (auto-escalated when <10d to hearing)
    - Add last_auto_reminder_at for daily escalation tracking

  3. Security: RLS enabled on all new tables with anon read + authenticated write
*/

-- ── trustee_api_configs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustee_api_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trustee_id          uuid NOT NULL REFERENCES trustees(id) ON DELETE CASCADE,
  portal_name         text NOT NULL DEFAULT '',
  portal_url          text,
  api_type            text NOT NULL DEFAULT 'manual', -- 'manual' | 'email' | 'rest' | 'ecf'
  api_endpoint        text,
  api_key_hint        text, -- last 4 chars only, never store full key
  submission_email    text,
  ecf_login           text,
  notes               text,
  enabled             boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE trustee_api_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_api_configs' AND policyname='Anon can read api configs') THEN
    EXECUTE 'CREATE POLICY "Anon can read api configs" ON trustee_api_configs FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_api_configs' AND policyname='Auth can manage api configs') THEN
    EXECUTE 'CREATE POLICY "Auth can manage api configs" ON trustee_api_configs FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── trustee_portal_submissions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustee_portal_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid NOT NULL REFERENCES trustee_document_requests(id) ON DELETE CASCADE,
  trustee_id          uuid NOT NULL REFERENCES trustees(id),
  api_config_id       uuid REFERENCES trustee_api_configs(id),
  submitted_by        text,
  submitted_at        timestamptz DEFAULT now(),
  method              text NOT NULL DEFAULT 'manual', -- 'manual' | 'email' | 'rest' | 'ecf'
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','confirmed','failed')),
  response_code       text,
  response_message    text,
  documents_included  text[], -- list of document names included
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE trustee_portal_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_portal_submissions' AND policyname='Anon can read submissions') THEN
    EXECUTE 'CREATE POLICY "Anon can read submissions" ON trustee_portal_submissions FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_portal_submissions' AND policyname='Auth can manage submissions') THEN
    EXECUTE 'CREATE POLICY "Auth can manage submissions" ON trustee_portal_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── trustee_paralegal_reviews ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustee_paralegal_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid NOT NULL REFERENCES trustee_document_requests(id) ON DELETE CASCADE,
  trustee_id          uuid NOT NULL REFERENCES trustees(id),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_review','approved','needs_correction','rejected')),
  assigned_to         text,
  reviewed_by         text,
  review_started_at   timestamptz,
  review_completed_at timestamptz,
  notes               text,
  rejection_reason    text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE trustee_paralegal_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_paralegal_reviews' AND policyname='Anon can read paralegal reviews') THEN
    EXECUTE 'CREATE POLICY "Anon can read paralegal reviews" ON trustee_paralegal_reviews FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_paralegal_reviews' AND policyname='Auth can manage paralegal reviews') THEN
    EXECUTE 'CREATE POLICY "Auth can manage paralegal reviews" ON trustee_paralegal_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── trustee_paralegal_review_items ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustee_paralegal_review_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           uuid NOT NULL REFERENCES trustee_paralegal_reviews(id) ON DELETE CASCADE,
  request_item_id     uuid NOT NULL REFERENCES trustee_request_items(id),
  document_name       text NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','needs_correction','waived')),
  paralegal_note      text,
  confirmed_at        timestamptz,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE trustee_paralegal_review_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_paralegal_review_items' AND policyname='Anon can read review items') THEN
    EXECUTE 'CREATE POLICY "Anon can read review items" ON trustee_paralegal_review_items FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_paralegal_review_items' AND policyname='Auth can manage review items') THEN
    EXECUTE 'CREATE POLICY "Auth can manage review items" ON trustee_paralegal_review_items FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── Add priority + paralegal columns to trustee_document_requests ────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='priority_level') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN priority_level text DEFAULT 'normal'
      CHECK (priority_level IN ('normal','elevated','critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='last_auto_reminder_at') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN last_auto_reminder_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='paralegal_review_status') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN paralegal_review_status text DEFAULT 'not_started'
      CHECK (paralegal_review_status IN ('not_started','pending','in_review','approved','needs_correction'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='paralegal_reviewed_by') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN paralegal_reviewed_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='submitted_to_trustee_at') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN submitted_to_trustee_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='trustee_submission_id') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN trustee_submission_id uuid;
  END IF;
END $$;

-- ── Seed API configs for example trustees ────────────────────────────────────

INSERT INTO trustee_api_configs (trustee_id, portal_name, api_type, submission_email, notes, enabled)
SELECT id, name || ' — Document Portal', 'email', email,
  'Configure API credentials to enable direct portal submission.', false
FROM trustees
WHERE id IN (
  '5055951d-9230-4295-9e8f-d2d1f08a77da', -- AZ Ch7 Birdsell
  'fd3eda85-c095-4538-80df-853f78c01ec3', -- AZ Ch13 Brown
  '9915ff3a-0cad-40b9-8006-6c2c4abb0457', -- WA Ch7 Ellis
  '4e49bf4e-430c-4c0b-b35a-fa77acea2ddf'  -- WA Ch13 Wilson-Aguilar
)
ON CONFLICT DO NOTHING;

-- ── Set priority levels on seeded clients based on days to hearing ────────────

UPDATE trustee_document_requests
SET priority_level = CASE
  WHEN hearing_341_date IS NULL THEN 'normal'
  WHEN hearing_341_date <= CURRENT_DATE + 7  THEN 'critical'
  WHEN hearing_341_date <= CURRENT_DATE + 14 THEN 'elevated'
  ELSE 'normal'
END
WHERE priority_level = 'normal';
