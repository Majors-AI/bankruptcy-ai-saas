/*
  # Filed Cases Registry & IOLTA Attorney Sign-Off

  ## Summary
  Tracks filed cases with verified case numbers, creates a transferable case list,
  and enforces attorney sign-off on IOLTA fund releases before they can be transferred.

  ## New Tables

  ### `accounting_filed_case_registry`
  Master list of filed cases with case number verification status and transfer readiness.
  - `id` (uuid, pk)
  - `client_id` (uuid, fk → accounting_clients) — the client
  - `case_number` (text) — court-assigned case number (e.g. "2:26-bk-04812")
  - `filed_date` (date) — date the case was filed in court
  - `chapter` (smallint) — 7 or 13
  - `state` (char 2) — state where filed
  - `case_number_verified` (boolean) — confirmed case number matches court records
  - `case_number_verified_by` (text) — staff member who verified
  - `case_number_verified_at` (timestamptz) — when verified
  - `verification_notes` (text) — any notes about verification
  - `iolta_balance_verified` (boolean) — attorney has confirmed IOLTA balance is correct
  - `iolta_verified_by` (text) — attorney who verified IOLTA balance
  - `iolta_verified_at` (timestamptz) — when IOLTA was verified
  - `iolta_verified_amount` (numeric) — the amount the attorney confirmed
  - `iolta_signoff_notes` (text) — attorney signoff notes
  - `transfer_status` (text) — 'not_ready' | 'pending_signoff' | 'signed_off' | 'transferred'
  - `transferred_at` (timestamptz) — when funds were transferred
  - `transferred_by` (text) — who executed the transfer
  - `transfer_notes` (text)
  - `created_at`, `updated_at`

  ### `accounting_iolta_signoffs`
  Audit log of every attorney IOLTA sign-off event.
  - `id` (uuid, pk)
  - `registry_id` (uuid, fk → accounting_filed_case_registry)
  - `client_id` (uuid, fk → accounting_clients)
  - `attorney_name` (text)
  - `action` (text) — 'verified' | 'rejected' | 'transfer_approved'
  - `iolta_amount` (numeric)
  - `notes` (text)
  - `signed_at` (timestamptz)

  ## Security
  - RLS enabled, anon access for firm-internal portal
*/

-- ── accounting_filed_case_registry ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_filed_case_registry (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  case_number               text NOT NULL DEFAULT '',
  filed_date                date NOT NULL,
  chapter                   smallint NOT NULL CHECK (chapter IN (7, 13)),
  state                     char(2) NOT NULL,
  case_number_verified      boolean NOT NULL DEFAULT false,
  case_number_verified_by   text,
  case_number_verified_at   timestamptz,
  verification_notes        text,
  iolta_balance_verified    boolean NOT NULL DEFAULT false,
  iolta_verified_by         text,
  iolta_verified_at         timestamptz,
  iolta_verified_amount     numeric(10,2),
  iolta_signoff_notes       text,
  transfer_status           text NOT NULL DEFAULT 'not_ready'
    CHECK (transfer_status IN ('not_ready', 'pending_signoff', 'signed_off', 'transferred')),
  transferred_at            timestamptz,
  transferred_by            text,
  transfer_notes            text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounting_filed_case_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_filed_case_registry"
  ON accounting_filed_case_registry FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert accounting_filed_case_registry"
  ON accounting_filed_case_registry FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update accounting_filed_case_registry"
  ON accounting_filed_case_registry FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_filed_registry_client ON accounting_filed_case_registry(client_id);
CREATE INDEX IF NOT EXISTS idx_filed_registry_status ON accounting_filed_case_registry(transfer_status);
CREATE INDEX IF NOT EXISTS idx_filed_registry_state ON accounting_filed_case_registry(state);

-- ── accounting_iolta_signoffs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_iolta_signoffs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id   uuid NOT NULL REFERENCES accounting_filed_case_registry(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  attorney_name text NOT NULL,
  action        text NOT NULL CHECK (action IN ('verified', 'rejected', 'transfer_approved')),
  iolta_amount  numeric(10,2) NOT NULL DEFAULT 0,
  notes         text,
  signed_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounting_iolta_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read accounting_iolta_signoffs"
  ON accounting_iolta_signoffs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert accounting_iolta_signoffs"
  ON accounting_iolta_signoffs FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_iolta_signoffs_registry ON accounting_iolta_signoffs(registry_id);
CREATE INDEX IF NOT EXISTS idx_iolta_signoffs_client ON accounting_iolta_signoffs(client_id);

-- ── Auto-populate registry for existing filed clients ─────────────────────────

INSERT INTO accounting_filed_case_registry (
  client_id, case_number, filed_date, chapter, state, transfer_status
)
SELECT
  ac.id,
  COALESCE(ac.case_number, ''),
  COALESCE(ac.filed_date, CURRENT_DATE),
  ac.chapter,
  COALESCE(ac.state, 'AZ'),
  CASE
    WHEN ac.case_number IS NOT NULL AND ac.case_number != '' THEN 'pending_signoff'
    ELSE 'not_ready'
  END
FROM accounting_clients ac
WHERE ac.status IN ('filed', 'closed')
  AND NOT EXISTS (
    SELECT 1 FROM accounting_filed_case_registry r WHERE r.client_id = ac.id
  );
