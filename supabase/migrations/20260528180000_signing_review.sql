/*
  MAJ-104: Signing Review (step 7.5)

  Stores the pre-signing case review performed by a paralegal or attorney
  before the client's signing appointment. The `items` JSONB column is an
  array of per-checklist-item objects:

    {
      "item_key":    "vol_petition",
      "status":      "not_yet_reviewed" | "verified" | "needs_correction",
      "notes":       "...",
      "reviewed_by": "Jennifer Smith, Esq.",
      "reviewed_at": "2026-05-28T14:30:00Z"
    }

  Paused reviews can be resumed — the app loads the latest in_progress or
  paused row for the client and restores state. Completed reviews are
  immutable (the app creates a fresh row for the next review cycle).

  Depends on: firms (20260527020000_firms_and_user_profiles.sql)
*/

CREATE TABLE IF NOT EXISTS signing_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     text        NOT NULL,
  firm_id       uuid        NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  reviewer_id   uuid        REFERENCES auth.users(id),
  reviewer_role text        NOT NULL CHECK (reviewer_role IN ('paralegal', 'attorney', 'legal_admin', 'firm_super_admin', 'super_admin_bankruptcy_ai')),
  status        text        NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
  items         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signing_reviews_client
  ON signing_reviews(client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signing_reviews_firm
  ON signing_reviews(firm_id, status);

-- Auto-update updated_at on row change.
CREATE OR REPLACE FUNCTION update_signing_reviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_signing_reviews_updated_at ON signing_reviews;
CREATE TRIGGER trg_signing_reviews_updated_at
  BEFORE UPDATE ON signing_reviews
  FOR EACH ROW EXECUTE FUNCTION update_signing_reviews_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE signing_reviews ENABLE ROW LEVEL SECURITY;

-- Anon read/write: matches the existing codebase pattern where the app uses
-- the anon key directly. Tighten to authenticated + firm_id check once
-- BAN-40 phase 2 (auth context) ships.
CREATE POLICY "anon_select_signing_reviews" ON signing_reviews
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_signing_reviews" ON signing_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_signing_reviews" ON signing_reviews
  FOR UPDATE USING (true);

CREATE POLICY "anon_delete_signing_reviews" ON signing_reviews
  FOR DELETE USING (true);
