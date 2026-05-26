/*
  # Storage RLS Policies for check-images bucket

  Allows anonymous users to upload and read check images,
  consistent with the rest of the project's storage access pattern.
*/

CREATE POLICY "public read check images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'check-images');

CREATE POLICY "anon upload check images"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'check-images');

CREATE POLICY "anon update check images"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'check-images');
