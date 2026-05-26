
-- 1) Remove sensitive payment tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.paiements;
ALTER PUBLICATION supabase_realtime DROP TABLE public.abonnements;

-- 2) Realtime channel authorization: scope topic to current entreprise
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant scoped realtime read" ON realtime.messages;
CREATE POLICY "tenant scoped realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('rt:%:' || public.current_entreprise_id()::text || ':%')
  OR realtime.topic() = ('notifications:' || public.current_entreprise_id()::text)
);

DROP POLICY IF EXISTS "tenant scoped realtime write" ON realtime.messages;
CREATE POLICY "tenant scoped realtime write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE ('rt:%:' || public.current_entreprise_id()::text || ':%')
  OR realtime.topic() = ('notifications:' || public.current_entreprise_id()::text)
);

-- 3) Restrict invitations INSERT to admins
DROP POLICY IF EXISTS "ent insert invitations" ON public.invitations;
CREATE POLICY "admin insert invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (
  entreprise_id = public.current_entreprise_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "ent update invitations" ON public.invitations;
CREATE POLICY "admin update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  entreprise_id = public.current_entreprise_id()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "ent delete invitations" ON public.invitations;
CREATE POLICY "admin delete invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (
  entreprise_id = public.current_entreprise_id()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- 4) Make logos bucket private and add tenant-scoped SELECT
UPDATE storage.buckets SET public = false WHERE id = 'logos';

CREATE POLICY "logos auth select own ent"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = public.current_entreprise_id()::text
);
