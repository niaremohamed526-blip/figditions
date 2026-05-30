
-- 1. permissions JSONB on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
    "dashboard": true,
    "manuscrits": true,
    "auteurs": true,
    "stocks_interne": true,
    "stocks_externe": true,
    "finances": true,
    "contrats": true,
    "conversions": true,
    "estimateur": true,
    "imprimeries": true,
    "parametres": false
  }'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_label text;

-- Admins keep full access including parametres
UPDATE public.profiles
SET permissions = permissions || '{"parametres": true}'::jsonb
WHERE role = 'admin';

-- 2. invitations: permissions + invitee info
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{"dashboard": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS role_label text;

-- 3. Allow invited members to insert their profile as 'membre' (or legacy 'editeur')
DROP POLICY IF EXISTS "self insert profile" ON public.profiles;
CREATE POLICY "self insert profile" ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid() AND role IN ('editeur', 'membre'));

-- 4. self update: cannot change own role or permissions
DROP POLICY IF EXISTS "self update profile" ON public.profiles;
CREATE POLICY "self update profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND permissions = (SELECT p.permissions FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 5. Admin can update other members in same entreprise
DROP POLICY IF EXISTS "admin update members" ON public.profiles;
CREATE POLICY "admin update members" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    entreprise_id = public.current_entreprise_id()
    AND id <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (entreprise_id = public.current_entreprise_id());

-- 6. Admin can delete other members in same entreprise
DROP POLICY IF EXISTS "admin delete members" ON public.profiles;
CREATE POLICY "admin delete members" ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    entreprise_id = public.current_entreprise_id()
    AND id <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 7. Admin can read all profiles in same entreprise (currently only self can SELECT)
DROP POLICY IF EXISTS "members select entreprise" ON public.profiles;
CREATE POLICY "members select entreprise" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (entreprise_id = public.current_entreprise_id());

-- 8. Block client INSERT on abonnements (security fix: only service_role/webhook writes)
DROP POLICY IF EXISTS "ent insert abonnements" ON public.abonnements;
CREATE POLICY "block client insert abonnements" ON public.abonnements
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 9. Notifications: explicit block on client INSERT/DELETE
DROP POLICY IF EXISTS "block client insert notifications" ON public.notifications;
CREATE POLICY "block client insert notifications" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS "block client delete notifications" ON public.notifications;
CREATE POLICY "block client delete notifications" ON public.notifications
  FOR DELETE
  TO authenticated
  USING (false);

-- 10. Update handle_new_user to honour invitation permissions/full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_ent_id UUID;
  v_full_name TEXT;
  v_ent_nom TEXT;
  v_ville TEXT;
  v_invite_token UUID;
  v_inv RECORD;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_invite_token := NULLIF(NEW.raw_user_meta_data->>'invite_token', '')::uuid;

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.invitations
    WHERE token = v_invite_token
      AND statut = 'en_attente'
      AND expires_at > now()
    LIMIT 1;

    IF v_inv.id IS NOT NULL THEN
      INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions, role_label)
      VALUES (
        NEW.id,
        COALESCE(v_inv.full_name, v_full_name),
        v_inv.entreprise_id,
        'membre',
        v_inv.permissions,
        v_inv.role_label
      );
      UPDATE public.invitations SET statut = 'acceptee' WHERE id = v_inv.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Fallback: new owner creating their own entreprise
  v_ent_nom := COALESCE(NEW.raw_user_meta_data->>'entreprise_nom', v_full_name || ' Éditions');
  v_ville := COALESCE(NEW.raw_user_meta_data->>'ville', 'Bamako');

  INSERT INTO public.entreprises(nom, ville, owner_id)
  VALUES (v_ent_nom, v_ville, NEW.id)
  RETURNING id INTO new_ent_id;

  INSERT INTO public.profiles(id, full_name, entreprise_id, role,
    permissions
  )
  VALUES (
    NEW.id, v_full_name, new_ent_id, 'admin',
    '{"dashboard":true,"manuscrits":true,"auteurs":true,"stocks_interne":true,"stocks_externe":true,"finances":true,"contrats":true,"conversions":true,"estimateur":true,"imprimeries":true,"parametres":true}'::jsonb
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
