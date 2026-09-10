-- Supabase-only operator step, AFTER creating juyu-private through the Storage API.
-- Never run automatically in application startup. Generic local migrations exclude this file.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='juyu-private' AND public=false) THEN
    RAISE EXCEPTION 'PRIVATE_BUCKET_REQUIRED: create the private bucket with the Storage API first';
  END IF;
END $$;
-- Restrictive policy also denies this bucket when an older permissive object policy exists.
DROP POLICY IF EXISTS juyu_private_server_only ON storage.objects;
CREATE POLICY juyu_private_server_only ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon,authenticated
  USING (bucket_id<>'juyu-private') WITH CHECK (bucket_id<>'juyu-private');
COMMIT;
