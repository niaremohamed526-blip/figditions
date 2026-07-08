-- Allow the SECURITY DEFINER redeem_promo_code RPC to bypass the guard trigger
CREATE OR REPLACE FUNCTION public.guard_entreprises_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Trusted server-side RPCs set this GUC before touching subscription fields.
  IF current_setting('app.allow_subscription_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.max_utilisateurs IS DISTINCT FROM OLD.max_utilisateurs
     OR NEW.abonnement_expire_le IS DISTINCT FROM OLD.abonnement_expire_le THEN
    RAISE EXCEPTION 'Les champs d''abonnement ne peuvent être modifiés que côté serveur';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text, p_entreprise_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_user_ent UUID;
  v_promo RECORD;
  v_expire TIMESTAMPTZ;
  v_max_users INTEGER;
  v_normalized TEXT := upper(regexp_replace(coalesce(p_code,''), '\s+', '', 'g'));
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous devez être connecté');
  END IF;

  SELECT role, entreprise_id INTO v_role, v_user_ent
  FROM public.profiles WHERE id = v_user_id;

  IF v_role IS DISTINCT FROM 'admin' OR v_user_ent IS DISTINCT FROM p_entreprise_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un admin de l''entreprise peut utiliser un code');
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE upper(regexp_replace(code, '\s+', '', 'g')) = v_normalized
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code introuvable — vérifiez l''orthographe');
  END IF;

  IF v_promo.actif = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce code est désactivé');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce code a expiré');
  END IF;

  IF v_promo.utilisations_actuelles >= v_promo.max_utilisations THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce code a atteint son nombre maximum d''utilisations');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.promo_code_redemptions
    WHERE promo_code_id = v_promo.id AND entreprise_id = p_entreprise_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Votre entreprise a déjà utilisé ce code');
  END IF;

  IF v_promo.periode = 'a_vie' THEN
    v_expire := NULL;
  ELSIF v_promo.duree_jours IS NOT NULL THEN
    v_expire := now() + make_interval(days => v_promo.duree_jours);
  ELSIF v_promo.periode = 'annuel' THEN
    v_expire := now() + interval '1 year';
  ELSE
    v_expire := now() + interval '1 month';
  END IF;

  v_max_users := CASE v_promo.plan WHEN 'business' THEN 999 WHEN 'pro' THEN 3 ELSE 1 END;

  -- Authorize the sensitive UPDATE below for this transaction only.
  PERFORM set_config('app.allow_subscription_update', 'on', true);

  UPDATE public.entreprises
  SET plan = v_promo.plan,
      max_utilisateurs = v_max_users,
      abonnement_expire_le = v_expire
  WHERE id = p_entreprise_id;

  PERFORM set_config('app.allow_subscription_update', 'off', true);

  INSERT INTO public.promo_code_redemptions (
    promo_code_id, entreprise_id, user_id, plan_applique, periode_appliquee, expire_le
  ) VALUES (
    v_promo.id, p_entreprise_id, v_user_id, v_promo.plan, v_promo.periode, v_expire
  );

  UPDATE public.promo_codes
  SET utilisations_actuelles = utilisations_actuelles + 1,
      updated_at = now()
  WHERE id = v_promo.id;

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_promo.plan,
    'periode', v_promo.periode,
    'expire_le', v_expire,
    'message', 'Plan ' || initcap(v_promo.plan) || ' activé'
  );
END;
$function$;