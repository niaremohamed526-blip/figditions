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
      -- Safety: never downgrade the entreprise owner to 'membre'.
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
          v_inv.permissions,
          v_inv.role_label
        );
      END IF;
      UPDATE public.invitations SET statut = 'acceptee' WHERE id = v_inv.id;
      RETURN NEW;
    END IF;
  END IF;

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

  RETURN NEW;
END;
$function$;