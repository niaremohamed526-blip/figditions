
-- Never-expire invitations
ALTER TABLE public.invitations ALTER COLUMN expires_at SET DEFAULT 'infinity'::timestamptz;
UPDATE public.invitations SET expires_at = 'infinity'::timestamptz WHERE statut = 'en_attente';

-- Drop expiry check in the public lookup
CREATE OR REPLACE FUNCTION public.get_invitation_public(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_ent_nom text;
BEGIN
  SELECT id, email, statut, permissions, full_name, role_label, entreprise_id
    INTO v_inv
  FROM public.invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;
  IF v_inv.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'used');
  END IF;

  SELECT nom INTO v_ent_nom FROM public.entreprises WHERE id = v_inv.entreprise_id;

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_inv.email,
    'full_name', v_inv.full_name,
    'role_label', v_inv.role_label,
    'permissions', COALESCE(v_inv.permissions, '{}'::jsonb),
    'entreprise_nom', COALESCE(v_ent_nom, 'votre maison d''édition')
  );
END;
$$;

-- Drop expiry check in accept_invitation (keep idempotent branch)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv RECORD;
  v_valid_keys text[] := ARRAY[
    'dashboard','manuscrits','auteurs','stocks_interne','stocks_externe',
    'finances','contrats','conversions','estimateur','imprimeries'
  ];
  v_perms jsonb := '{"dashboard":true}'::jsonb;
  v_k text;
  v_profile_ent uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifié');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation introuvable');
  END IF;

  IF v_inv.statut = 'acceptee' THEN
    SELECT entreprise_id INTO v_profile_ent FROM public.profiles WHERE id = v_uid;
    IF v_profile_ent = v_inv.entreprise_id AND lower(v_email) = lower(v_inv.email) THEN
      RETURN jsonb_build_object('ok', true, 'entreprise_id', v_inv.entreprise_id, 'already', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation déjà utilisée');
  END IF;

  IF v_inv.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation déjà utilisée');
  END IF;
  IF lower(v_email) <> lower(v_inv.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ce lien n''est pas valide pour votre adresse email');
  END IF;

  FOREACH v_k IN ARRAY v_valid_keys LOOP
    IF (v_inv.permissions ? v_k) AND (v_inv.permissions ->> v_k)::boolean = true THEN
      v_perms := v_perms || jsonb_build_object(v_k, true);
    END IF;
  END LOOP;
  v_perms := v_perms || jsonb_build_object('parametres', false);

  DELETE FROM public.entreprises
  WHERE owner_id = v_uid AND id <> v_inv.entreprise_id;

  UPDATE public.profiles
  SET entreprise_id = v_inv.entreprise_id,
      role = 'membre',
      permissions = v_perms,
      role_label = v_inv.role_label,
      full_name = COALESCE(v_inv.full_name, full_name)
  WHERE id = v_uid;

  UPDATE public.invitations SET statut = 'acceptee' WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'entreprise_id', v_inv.entreprise_id);
END;
$$;

-- Drop expiry filter in handle_new_user so the invite branch works forever
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_ent_id UUID;
  v_full_name TEXT;
  v_ent_nom TEXT;
  v_ville TEXT;
  v_invite_token UUID;
  v_inv RECORD;
  v_owner_id UUID;
  v_profile_created BOOLEAN := false;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_invite_token := NULLIF(NEW.raw_user_meta_data->>'invite_token', '')::uuid;

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.invitations
    WHERE token = v_invite_token
      AND statut = 'en_attente'
    LIMIT 1;

    IF v_inv.id IS NOT NULL THEN
      BEGIN
        SELECT owner_id INTO v_owner_id FROM public.entreprises WHERE id = v_inv.entreprise_id;

        IF v_owner_id = NEW.id THEN
          INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions)
          VALUES (
            NEW.id,
            COALESCE(v_inv.full_name, v_full_name),
            v_inv.entreprise_id,
            'admin',
            '{"dashboard":true,"manuscrits":true,"auteurs":true,"stocks_interne":true,"stocks_externe":true,"finances":true,"contrats":true,"conversions":true,"estimateur":true,"imprimeries":true,"parametres":true}'::jsonb
          );
        ELSE
          INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions, role_label)
          VALUES (
            NEW.id,
            COALESCE(v_inv.full_name, v_full_name),
            v_inv.entreprise_id,
            'membre',
            COALESCE(v_inv.permissions, '{"dashboard":true}'::jsonb) || '{"parametres":false}'::jsonb,
            v_inv.role_label
          );
        END IF;
        UPDATE public.invitations SET statut = 'acceptee' WHERE id = v_inv.id;
        v_profile_created := true;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user invite branch failed for user %: %', NEW.id, SQLERRM;
      END;

      IF v_profile_created THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    v_ent_nom := COALESCE(NEW.raw_user_meta_data->>'entreprise_nom', v_full_name || ' Éditions');
    v_ville := COALESCE(NEW.raw_user_meta_data->>'ville', 'Bamako');

    INSERT INTO public.entreprises(nom, ville, owner_id)
    VALUES (v_ent_nom, v_ville, NEW.id)
    RETURNING id INTO new_ent_id;

    INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions)
    VALUES (
      NEW.id, v_full_name, new_ent_id, 'admin',
      '{"dashboard":true,"manuscrits":true,"auteurs":true,"stocks_interne":true,"stocks_externe":true,"finances":true,"contrats":true,"conversions":true,"estimateur":true,"imprimeries":true,"parametres":true}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$function$;
