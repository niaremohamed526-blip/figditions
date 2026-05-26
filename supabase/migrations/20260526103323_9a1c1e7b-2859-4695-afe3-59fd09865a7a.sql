
CREATE POLICY "logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "logos auth insert own ent"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = public.current_entreprise_id()::text
);

CREATE POLICY "logos auth update own ent"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = public.current_entreprise_id()::text
);

CREATE POLICY "logos auth delete own ent"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = public.current_entreprise_id()::text
);
