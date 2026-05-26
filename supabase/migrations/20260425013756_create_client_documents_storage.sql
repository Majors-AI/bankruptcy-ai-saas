/*
  # Client Documents — Storage Bucket + Metadata Table

  ## Purpose
  Stores all client-uploaded documents with structured metadata. Documents are
  organised in Supabase Storage under a single bucket `client-documents` using
  the path convention:

      {client_id}/{document_category}/{document_type}_{YYYY-MM-DD}_{original_filename}

  Examples:
      client-abc123/identity/id_front_2026-04-25_license.jpg
      client-abc123/secured-creditors/mortgage_stmt_2026-04-25_chase.pdf
      client-abc123/vehicles/vehicle_loan_stmt_2026-04-25_ford.jpg
      client-abc123/hoa/hoa_stmt_2026-04-25_mapleton.jpg

  ## New Tables
  - `client_documents`
    - `id` (uuid pk)
    - `client_id` (text) — matches session_progress.client_id
    - `document_type` (text) — e.g. "id_front", "id_back", "ss_card", "mortgage_stmt", "vehicle_loan_stmt", "hoa_stmt"
    - `document_category` (text) — e.g. "identity", "secured-creditors", "vehicles", "hoa"
    - `storage_path` (text) — full path within bucket
    - `original_filename` (text)
    - `mime_type` (text)
    - `ai_extracted_data` (jsonb, nullable) — structured data AI read from document
    - `ai_verified` (boolean) — whether AI approved the document
    - `ai_note` (text, nullable) — AI-generated note shown to client
    - `uploaded_at` (timestamptz)
    - `context_ref` (text, nullable) — e.g. "property_0", "vehicle_1" for multi-item contexts
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated clients can only access their own rows
*/

CREATE TABLE IF NOT EXISTS client_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         text NOT NULL DEFAULT '',
  document_type     text NOT NULL DEFAULT '',
  document_category text NOT NULL DEFAULT '',
  storage_path      text NOT NULL DEFAULT '',
  original_filename text NOT NULL DEFAULT '',
  mime_type         text NOT NULL DEFAULT '',
  ai_extracted_data jsonb,
  ai_verified       boolean NOT NULL DEFAULT false,
  ai_note           text,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  context_ref       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own documents"
  ON client_documents FOR SELECT
  TO authenticated
  USING (client_id = auth.uid()::text);

CREATE POLICY "Clients can insert own documents"
  ON client_documents FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid()::text);

CREATE POLICY "Clients can update own documents"
  ON client_documents FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid()::text)
  WITH CHECK (client_id = auth.uid()::text);
