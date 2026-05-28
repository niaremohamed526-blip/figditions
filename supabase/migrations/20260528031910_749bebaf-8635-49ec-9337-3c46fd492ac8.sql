-- 1) Guard sensitive subscription fields on entreprises against client-side bypass.
CREATE OR REPLACE FUNCTION public.guard_entreprises_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (server / webhook) to change anything.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.max_utilisateurs IS DISTINCT FROM OLD.max_utilisateurs
     OR NEW.abonnement_expire_le IS DISTINCT FROM OLD.abonnement_expire_le THEN
    RAISE EXCEPTION 'Les champs d''abonnement ne peuvent être modifiés que côté serveur';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_entreprises_sensitive ON public.entreprises;
CREATE TRIGGER trg_guard_entreprises_sensitive
BEFORE UPDATE ON public.entreprises
FOR EACH ROW
EXECUTE FUNCTION public.guard_entreprises_sensitive_fields();

-- 2) abonnements: block client UPDATE / DELETE explicitly (service_role bypasses RLS).
DROP POLICY IF EXISTS "block client update abonnements" ON public.abonnements;
CREATE POLICY "block client update abonnements"
ON public.abonnements
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "block client delete abonnements" ON public.abonnements;
CREATE POLICY "block client delete abonnements"
ON public.abonnements
FOR DELETE
TO authenticated
USING (false);

-- 3) paiements: block all client writes explicitly (service_role bypasses RLS).
DROP POLICY IF EXISTS "block client insert paiements" ON public.paiements;
CREATE POLICY "block client insert paiements"
ON public.paiements
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "block client update paiements" ON public.paiements;
CREATE POLICY "block client update paiements"
ON public.paiements
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "block client delete paiements" ON public.paiements;
CREATE POLICY "block client delete paiements"
ON public.paiements
FOR DELETE
TO authenticated
USING (false);

-- 4) invitations: scope the admin select policy to authenticated users only.
DROP POLICY IF EXISTS "admin select invitations" ON public.invitations;
CREATE POLICY "admin select invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  (entreprise_id = current_entreprise_id())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);