CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF lower(v_email) <> lower(v_inv.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ce lien n''est pas valide pour votre adresse email');
  END IF;

  FOREACH v_k IN ARRAY v_valid_keys LOOP
    IF (v_inv.permissions ? v_k) AND (v_inv.permissions ->> v_k)::boolean = true THEN
      v_perms := v_perms || jsonb_build_object(v_k, true);
    END IF;
  END LOOP;
  v_perms := v_perms || jsonb_build_object('parametres', false);

  IF v_inv.statut = 'acceptee' THEN
    SELECT entreprise_id INTO v_profile_ent FROM public.profiles WHERE id = v_uid;
    IF v_profile_ent = v_inv.entreprise_id THEN
      UPDATE public.profiles
      SET role = 'membre',
          permissions = v_perms,
          role_label = v_inv.role_label,
          full_name = COALESCE(v_inv.full_name, full_name)
      WHERE id = v_uid;
      RETURN jsonb_build_object('ok', true, 'entreprise_id', v_inv.entreprise_id, 'already', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation déjà utilisée');
  END IF;

  IF v_inv.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation déjà utilisée');
  END IF;

  DELETE FROM public.entreprises
  WHERE owner_id = v_uid AND id <> v_inv.entreprise_id;

  UPDATE public.profiles
  SET entreprise_id = v_inv.entreprise_id,
      role = 'membre',
      permissions = v_perms,
      role_label = v_inv.role_label,
      full_name = COALESCE(v_inv.full_name, full_name)
  WHERE id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions, role_label)
    VALUES (v_uid, COALESCE(v_inv.full_name, split_part(v_email, '@', 1)), v_inv.entreprise_id, 'membre', v_perms, v_inv.role_label);
  END IF;

  UPDATE public.invitations SET statut = 'acceptee' WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'entreprise_id', v_inv.entreprise_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;