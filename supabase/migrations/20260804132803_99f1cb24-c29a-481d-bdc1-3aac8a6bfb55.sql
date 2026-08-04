ALTER TABLE public.paiements DROP CONSTRAINT IF EXISTS paiements_statut_check;
ALTER TABLE public.paiements ADD CONSTRAINT paiements_statut_check
  CHECK (statut = ANY (ARRAY['en_attente','en_attente_confirmation','succes','confirme','echec','rejete','rembourse']));

ALTER TABLE public.paiements DROP CONSTRAINT IF EXISTS paiements_methode_check;
ALTER TABLE public.paiements ADD CONSTRAINT paiements_methode_check
  CHECK (methode = ANY (ARRAY['orange_money','wave','carte_bancaire','autre']));

DROP FUNCTION IF EXISTS public.create_qr_payment_request(text, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.create_qr_payment_request(
  p_plan text,
  p_periode text,
  p_montant numeric,
  p_reference text,
  p_user_email text,
  p_methode text DEFAULT 'orange_money'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text; v_ent uuid; v_id uuid;
  v_methode text := lower(coalesce(p_methode, 'orange_money'));
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Non authentifié'); END IF;
  IF p_plan NOT IN ('pro','business') THEN RETURN jsonb_build_object('ok', false, 'error', 'Plan invalide'); END IF;
  IF p_periode NOT IN ('mensuel','annuel') THEN RETURN jsonb_build_object('ok', false, 'error', 'Période invalide'); END IF;
  IF v_methode NOT IN ('orange_money','wave') THEN RETURN jsonb_build_object('ok', false, 'error', 'Méthode invalide'); END IF;

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
    v_ent, p_montant, v_methode, 'en_attente_confirmation', 'manuel',
    p_plan, p_periode, p_reference, v_methode || '_qr',
    true, true, p_user_email, v_uid
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'reference', p_reference);
END;
$$;

REVOKE ALL ON FUNCTION public.create_qr_payment_request(text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_qr_payment_request(text, text, numeric, text, text, text) TO authenticated;