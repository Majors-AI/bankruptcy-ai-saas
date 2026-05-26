/*
  # Amendment Flags & Pending Document Requests

  ## Purpose
  Two new tables support two new features:

  ### 1. amendment_flags
  Tracks when a client re-opens the questionnaire to update previously submitted
  information. Stores a snapshot of the prior form_data so the system can diff
  it against the new submission and flag changed fields for attorney review.

  ### 2. pending_doc_requests
  Tracks documents the client deferred during the questionnaire (e.g., "I'll add
  the mortgage statement later"). These appear as outstanding requests in the
  Document Upload section and on the attorney dashboard.

  ## New Tables

  ### amendment_flags
  - `id` (uuid pk)
  - `client_id` (text)
  - `snapshot_data` (jsonb) — form_data at the moment "Update My Information" was clicked
  - `changed_sections` (jsonb) — array of section keys where changes were detected
  - `change_summary` (jsonb) — human-readable description of each change
  - `flagged_for_review` (boolean) — true once a save occurs with detected changes
  - `reviewed_by_attorney` (boolean) — set to true by attorney when reviewed
  - `reviewed_at` (timestamptz, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### pending_doc_requests
  - `id` (uuid pk)
  - `client_id` (text)
  - `doc_type` (text) — e.g. "mortgage_stmt", "vehicle_loan_stmt", "hoa_stmt"
  - `doc_label` (text) — human-readable e.g. "Mortgage Statement — Property 1"
  - `context_ref` (text) — e.g. "property_0", "vehicle_1"
  - `category` (text) — storage category e.g. "secured-creditors"
  - `status` (text) — "pending" | "uploaded" | "dismissed"
  - `deferred_at` (timestamptz)
  - `uploaded_at` (timestamptz, nullable)
  - `notes` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Authenticated clients can only access their own rows
*/

-- ── amendment_flags ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS amendment_flags (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            text NOT NULL DEFAULT '',
  snapshot_data        jsonb,
  changed_sections     jsonb,
  change_summary       jsonb,
  flagged_for_review   boolean NOT NULL DEFAULT false,
  reviewed_by_attorney boolean NOT NULL DEFAULT false,
  reviewed_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE amendment_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own amendment flags"
  ON amendment_flags FOR SELECT
  TO authenticated
  USING (client_id = auth.uid()::text);

CREATE POLICY "Clients can insert own amendment flags"
  ON amendment_flags FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid()::text);

CREATE POLICY "Clients can update own amendment flags"
  ON amendment_flags FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid()::text)
  WITH CHECK (client_id = auth.uid()::text);

-- ── pending_doc_requests ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_doc_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   text NOT NULL DEFAULT '',
  doc_type    text NOT NULL DEFAULT '',
  doc_label   text NOT NULL DEFAULT '',
  context_ref text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'pending',
  deferred_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pending_doc_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own pending doc requests"
  ON pending_doc_requests FOR SELECT
  TO authenticated
  USING (client_id = auth.uid()::text);

CREATE POLICY "Clients can insert own pending doc requests"
  ON pending_doc_requests FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid()::text);

CREATE POLICY "Clients can update own pending doc requests"
  ON pending_doc_requests FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid()::text)
  WITH CHECK (client_id = auth.uid()::text);
