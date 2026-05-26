
UPDATE storage.buckets SET public = true WHERE id = 'logos';
DROP POLICY IF EXISTS "logos auth select own ent" ON storage.objects;
