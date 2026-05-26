/*
  # Add anon read policies for trustee portal tables

  The Trustee Document Portal uses the anon key (no auth session) to read
  trustee data. All four lookup tables currently only allow authenticated
  users to SELECT, so the portal gets 0 rows back and shows "no trustees found".

  1. Changes
    - Add SELECT policy for anon role on: trustees, trustee_states,
      trustee_chapter_types, trustee_document_categories,
      trustee_document_requirements, trustee_document_requests,
      trustee_request_items, local_court_forms

  2. Security
    - Read-only (SELECT only) — no INSERT/UPDATE/DELETE for anon
    - Write operations still require authenticated role
*/

-- trustees
CREATE POLICY "Anon users can read trustees"
  ON trustees FOR SELECT
  TO anon
  USING (true);

-- trustee_states
CREATE POLICY "Anon users can read trustee states"
  ON trustee_states FOR SELECT
  TO anon
  USING (true);

-- trustee_chapter_types
CREATE POLICY "Anon users can read chapter types"
  ON trustee_chapter_types FOR SELECT
  TO anon
  USING (true);

-- trustee_document_categories
CREATE POLICY "Anon users can read doc categories"
  ON trustee_document_categories FOR SELECT
  TO anon
  USING (true);

-- trustee_document_requirements
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'trustee_document_requirements'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Anon users can read doc requirements"
        ON trustee_document_requirements FOR SELECT
        TO anon
        USING (true)
    $policy$;
  END IF;
END $$;

-- trustee_document_requests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'trustee_document_requests'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Anon users can read doc requests"
        ON trustee_document_requests FOR SELECT
        TO anon
        USING (true)
    $policy$;
  END IF;
END $$;

-- trustee_request_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'trustee_request_items'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Anon users can read request items"
        ON trustee_request_items FOR SELECT
        TO anon
        USING (true)
    $policy$;
  END IF;
END $$;

-- local_court_forms
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'local_court_forms'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Anon users can read local court forms"
        ON local_court_forms FOR SELECT
        TO anon
        USING (true)
    $policy$;
  END IF;
END $$;
