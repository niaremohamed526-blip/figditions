
-- Add broader fallback policies that use a direct join to profiles
-- (in case private.current_entreprise_id() returns null for the caller).

DROP POLICY IF EXISTS "logos member upload" ON storage.objects;
CREATE POLICY "logos member upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.entreprise_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "logos member update" ON storage.objects;
CREATE POLICY "logos member update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.entreprise_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.entreprise_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "logos member delete" ON storage.objects;
CREATE POLICY "logos member delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.entreprise_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'logos');
