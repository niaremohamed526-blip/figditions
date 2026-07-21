
-- 1) accept_invitation: remove destructive cascade delete of user's other companies
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

  -- SECURITY: never delete other entreprises the user owns. If the user still
  -- owns other companies, refuse and require manual deletion. Prevents a
  -- malicious invitation from wiping the victim's own tenant data.
  IF EXISTS (
    SELECT 1 FROM public.entreprises
    WHERE owner_id = v_uid AND id <> v_inv.entreprise_id
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Vous possédez déjà une maison d''édition. Pour rejoindre une autre entreprise, supprimez d''abord la vôtre depuis Paramètres.',
      'code', 'owns_other_entreprise'
    );
  END IF;

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

-- 2) Revoke EXECUTE from anon/authenticated on internal trigger + helper functions
REVOKE EXECUTE ON FUNCTION public.touch_stock_interne() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_stocks_vente_delta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_manuscrit_inserted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_vente_paye() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_vente_inserted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_auteur_delete_unlink() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_manuscrit_delete_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_stock_interne_bas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_manuscrit_publie() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_mouvement_cascade() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pdf_partages_check_manuscrit_tenant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_entreprises_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_bordereaux() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_ventes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_manuscrits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_contrats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pourcentage_droits_pour(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Ensure intended user-facing RPCs remain callable
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bordereau(text, text, text, date, date, jsonb, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_pdf_view(uuid) TO anon, authenticated;

-- 3) Restrict listing on the public logos bucket: only members of the owning
--    entreprise can enumerate objects. Individual files remain fetchable by
--    direct URL because the bucket is public.
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos read own ent"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (private.current_entreprise_id())::text
);
