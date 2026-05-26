
-- Fix 1: Prevent privilege escalation via profiles.role self-set
DROP POLICY IF EXISTS "self insert profile" ON public.profiles;
DROP POLICY IF EXISTS "self update profile" ON public.profiles;

CREATE POLICY "self insert profile"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid() AND role = 'editeur');

CREATE POLICY "self update profile"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
);

-- Fix 2: Restrict invitations SELECT to admins only (prevent token hijack)
DROP POLICY IF EXISTS "ent select invitations" ON public.invitations;

CREATE POLICY "admin select invitations"
ON public.invitations
FOR SELECT
USING (
  entreprise_id = public.current_entreprise_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Fix 3: Switch current_entreprise_id to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.current_entreprise_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()
$function$;

-- Fix 4: Remove broad public listing policy on logos bucket
-- Public URLs continue to serve files; this only blocks bucket listing.
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
