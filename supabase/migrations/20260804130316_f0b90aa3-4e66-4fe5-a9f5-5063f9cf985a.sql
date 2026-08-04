-- 1. Profiles: superadmin flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET is_superadmin = true
WHERE id IN (SELECT id FROM auth.users WHERE lower(email) = 'figditions@gmail.com');

CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_superadmin FROM public.profiles WHERE id = _user_id), false);
$$;
REVOKE ALL ON FUNCTION public.is_superadmin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated, service_role;

-- 2. Paiements: manual QR payment columns
ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS plan_demande text,
  ADD COLUMN IF NOT EXISTS periode text DEFAULT 'mensuel',
  ADD COLUMN IF NOT EXISTS reference_paiement text,
  ADD COLUMN IF NOT EXISTS methode_paiement text DEFAULT 'orange_money_qr',
  ADD COLUMN IF NOT EXISTS raison_rejet text,
  ADD COLUMN IF NOT EXISTS notification_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confirme_par uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirme_le timestamptz,
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.paiements ALTER COLUMN abonnement_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS paiements_reference_paiement_key
  ON public.paiements(reference_paiement) WHERE reference_paiement IS NOT NULL;

-- 3. Superadmin read access to paiements (tenant policies already exist)
DROP POLICY IF EXISTS "superadmin can read all paiements" ON public.paiements;
CREATE POLICY "superadmin can read all paiements" ON public.paiements
  FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- 4. Create a QR payment request (entreprise admin only)
CREATE OR REPLACE FUNCTION public.create_qr_payment_request(
  p_plan text, p_periode text, p_montant numeric, p_reference text, p_user_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text; v_ent uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Non authentifié'); END IF;
  IF p_plan NOT IN ('pro','business') THEN RETURN jsonb_build_object('ok', false, 'error', 'Plan invalide'); END IF;
  IF p_periode NOT IN ('mensuel','annuel') THEN RETURN jsonb_build_object('ok', false, 'error', 'Période invalide'); END IF;

  SELECT role, entreprise_id INTO v_role, v_ent FROM public.profiles WHERE id = v_uid;
  IF v_ent IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Profil sans entreprise'); END IF;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Seul un admin peut souscrire un plan');
  END IF;

  INSERT INTO public.paiements(
    entreprise_id, montant_fcfa, methode, statut, provider,
    plan_demande, periode, reference_paiement, methode_paiement,
    notification_whatsapp, notification_email, user_email, created_by
  ) VALUES (
    v_ent, p_montant, 'orange_money', 'en_attente_confirmation', 'manuel',
    p_plan, p_periode, p_reference, 'orange_money_qr',
    true, true, p_user_email, v_uid
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'reference', p_reference);
END; $$;
REVOKE ALL ON FUNCTION public.create_qr_payment_request(text,text,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_qr_payment_request(text,text,numeric,text,text) TO authenticated;

-- 5. Latest pending QR request for the current user's entreprise
CREATE OR REPLACE FUNCTION public.my_pending_qr_payment()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ent uuid; v_row RECORD;
BEGIN
  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = auth.uid();
  IF v_ent IS NULL THEN RETURN NULL; END IF;
  SELECT id, reference_paiement, plan_demande, periode, montant_fcfa, created_at
    INTO v_row FROM public.paiements
   WHERE entreprise_id = v_ent AND statut = 'en_attente_confirmation'
   ORDER BY created_at DESC LIMIT 1;
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_row);
END; $$;
REVOKE ALL ON FUNCTION public.my_pending_qr_payment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_pending_qr_payment() TO authenticated;

-- 6. Superadmin: list payments
CREATE OR REPLACE FUNCTION public.admin_list_paiements(p_statut text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'created_at' DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', p.id, 'created_at', p.created_at, 'entreprise_id', p.entreprise_id,
      'entreprise_nom', e.nom, 'entreprise_plan', e.plan,
      'user_email', COALESCE(p.user_email, e.email),
      'plan_demande', p.plan_demande, 'periode', p.periode,
      'montant_fcfa', p.montant_fcfa, 'reference_paiement', p.reference_paiement,
      'methode_paiement', p.methode_paiement, 'statut', p.statut,
      'raison_rejet', p.raison_rejet, 'confirme_le', p.confirme_le
    ) AS t
    FROM public.paiements p
    LEFT JOIN public.entreprises e ON e.id = p.entreprise_id
    WHERE p_statut IS NULL OR p.statut = p_statut
  ) s;
  RETURN v_rows;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_paiements(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_paiements(text) TO authenticated;

-- 7. Superadmin: stats
CREATE OR REPLACE FUNCTION public.admin_paiements_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pending int; v_confirmed int; v_revenue numeric; v_active int;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  SELECT COUNT(*) INTO v_pending FROM public.paiements WHERE statut = 'en_attente_confirmation';
  SELECT COUNT(*), COALESCE(SUM(montant_fcfa),0) INTO v_confirmed, v_revenue
    FROM public.paiements
   WHERE statut = 'confirme' AND confirme_le >= date_trunc('month', now());
  SELECT COUNT(*) INTO v_active FROM public.entreprises
   WHERE plan IN ('pro','business')
     AND (abonnement_expire_le IS NULL OR abonnement_expire_le > now());
  RETURN jsonb_build_object('pending', v_pending, 'confirmed_month', v_confirmed,
                            'revenue_month', v_revenue, 'active_subs', v_active);
END; $$;
REVOKE ALL ON FUNCTION public.admin_paiements_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_paiements_stats() TO authenticated;

-- 8. Superadmin: confirm a payment (activates plan)
CREATE OR REPLACE FUNCTION public.admin_confirm_paiement(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p RECORD; v_expire timestamptz; v_max int;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  SELECT * INTO v_p FROM public.paiements WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Paiement introuvable'); END IF;
  IF v_p.plan_demande NOT IN ('pro','business') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan demandé invalide');
  END IF;

  v_expire := now() + CASE WHEN v_p.periode = 'annuel' THEN interval '365 days' ELSE interval '30 days' END;
  v_max := CASE WHEN v_p.plan_demande = 'business' THEN 999 ELSE 3 END;

  PERFORM set_config('app.allow_subscription_update', 'on', true);
  UPDATE public.entreprises
     SET plan = v_p.plan_demande, max_utilisateurs = v_max, abonnement_expire_le = v_expire
   WHERE id = v_p.entreprise_id;
  PERFORM set_config('app.allow_subscription_update', 'off', true);

  UPDATE public.paiements
     SET statut = 'confirme', confirme_par = auth.uid(), confirme_le = now(), raison_rejet = NULL
   WHERE id = p_id;

  PERFORM public.fn_notify(
    v_p.entreprise_id, 'plan_active', '🎉 Plan activé',
    'Votre plan ' || initcap(v_p.plan_demande) || ' est maintenant actif.', '/parametres',
    jsonb_build_object('paiement_id', p_id)
  );

  RETURN jsonb_build_object('ok', true, 'plan', v_p.plan_demande, 'expire_le', v_expire);
END; $$;
REVOKE ALL ON FUNCTION public.admin_confirm_paiement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_confirm_paiement(uuid) TO authenticated;

-- 9. Superadmin: reject a payment
CREATE OR REPLACE FUNCTION public.admin_reject_paiement(p_id uuid, p_raison text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ent uuid;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  UPDATE public.paiements
     SET statut = 'rejete', raison_rejet = p_raison, confirme_par = auth.uid(), confirme_le = now()
   WHERE id = p_id
  RETURNING entreprise_id INTO v_ent;
  IF v_ent IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Paiement introuvable'); END IF;

  PERFORM public.fn_notify(
    v_ent, 'paiement_rejete', '⚠️ Paiement non validé',
    COALESCE(p_raison, 'Votre paiement n''a pas pu être validé.'), '/parametres',
    jsonb_build_object('paiement_id', p_id)
  );
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.admin_reject_paiement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_paiement(uuid, text) TO authenticated;