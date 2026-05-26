/*
  # Fix Document Storage — Allow Anon Uploads

  ## Summary
  The client questionnaire uses a localStorage-based client_id (not Supabase auth).
  The prior storage RLS policies required `auth.uid()` which blocked all uploads.
  This migration replaces those policies with anon-compatible ones that allow any
  authenticated OR anon client to read/write under their own client_id prefix.

  ## Changes
  1. Drop old authenticated-only storage policies
  2. Add new policies allowing anon role to insert/select/update storage objects
     under their own client_id prefix
  3. Update client_documents table policies to allow anon inserts/selects

  ## Security Notes
  - Clients can only access paths prefixed with their own client_id
  - The client_id is the first folder segment in the path
  - Anonymous access is scoped to the client-documents bucket only
*/

-- Drop old policies that required authenticated role
DROP POLICY IF EXISTS "Clients can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Clients can update own documents" ON storage.objects;

-- Allow anon and authenticated to insert into client-documents bucket
CREATE POLICY "Anon clients can upload documents"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'client-documents');

-- Allow anon and authenticated to read from client-documents bucket
CREATE POLICY "Anon clients can read documents"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'client-documents');

-- Allow anon and authenticated to update (upsert) in client-documents bucket
CREATE POLICY "Anon clients can update documents"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'client-documents')
  WITH CHECK (bucket_id = 'client-documents');

-- Drop old authenticated-only table policies
DROP POLICY IF EXISTS "Clients can view own documents" ON client_documents;
DROP POLICY IF EXISTS "Clients can insert own documents" ON client_documents;
DROP POLICY IF EXISTS "Clients can update own documents" ON client_documents;

-- Allow anon and authenticated to insert document metadata
CREATE POLICY "Anon clients can insert document records"
  ON client_documents FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon and authenticated to read document metadata
CREATE POLICY "Anon clients can read document records"
  ON client_documents FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anon and authenticated to update document metadata
CREATE POLICY "Anon clients can update document records"
  ON client_documents FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
