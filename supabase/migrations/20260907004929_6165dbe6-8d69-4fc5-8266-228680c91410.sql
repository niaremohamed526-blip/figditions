CREATE OR REPLACE FUNCTION public.zz_ventes_etranger_no_droits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_origine text;
BEGIN
  SELECT origine INTO v_origine FROM public.manuscrits WHERE id = NEW.manuscrit_id;
  IF v_origine = 'etranger' THEN
    NEW.droits_auteur_fcfa := 0;
    NEW.auteur_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.zz_ventes_etranger_no_droits() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.annuler_vente(p_vente_id uuid, p_raison text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ent uuid;
  v_vente public.ventes;
  v_stock public.stocks;
  v_interne public.stock_interne;
  v_reverse int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = v_uid;
  IF v_ent IS NULL THEN RAISE EXCEPTION 'Profil sans entreprise'; END IF;

  SELECT * INTO v_vente
    FROM public.ventes
   WHERE id = p_vente_id AND entreprise_id = v_ent
   FOR UPDATE;

  IF v_vente.id IS NULL THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
  IF v_vente.statut_annulation = 'annulee' THEN RAISE EXCEPTION 'Cette vente est déjà annulée'; END IF;
  IF v_vente.statut_paiement = 'paye' AND COALESCE(v_vente.droits_auteur_fcfa, 0) > 0 THEN
    RAISE EXCEPTION 'Les droits d''auteur de cette vente ont déjà été payés. Annulez d''abord le paiement de royalties correspondant.';
  END IF;

  v_reverse := COALESCE(v_vente.quantite_vendue, 0);

  IF v_vente.canal_vente = 'externe' AND v_vente.stock_id IS NOT NULL THEN
    SELECT * INTO v_stock
      FROM public.stocks
     WHERE id = v_vente.stock_id AND entreprise_id = v_ent
     FOR UPDATE;

    IF v_stock.id IS NOT NULL THEN
      UPDATE public.stocks SET
        exemplaires_vendus = GREATEST(0, COALESCE(exemplaires_vendus, 0) - v_reverse),
        exemplaires_restants = COALESCE(exemplaires_restants, 0) + v_reverse
      WHERE id = v_stock.id;
    END IF;

  ELSIF v_vente.canal_vente = 'interne' THEN
    SELECT * INTO v_interne
      FROM public.stock_interne
     WHERE manuscrit_id = v_vente.manuscrit_id AND entreprise_id = v_ent
     FOR UPDATE;

    IF v_interne.id IS NOT NULL THEN
      UPDATE public.stock_interne SET
        quantite_disponible = COALESCE(quantite_disponible, 0) + v_reverse,
        quantite_vendue_directement = GREATEST(0, COALESCE(quantite_vendue_directement, 0) - v_reverse),
        derniere_mise_a_jour = now()
      WHERE id = v_interne.id;
    END IF;
  END IF;

  UPDATE public.ventes SET
    statut_annulation = 'annulee',
    raison_annulation = NULLIF(btrim(COALESCE(p_raison, '')), ''),
    annulee_par = v_uid,
    annulee_le = now(),
    montant_encaisse_fcfa = 0,
    statut_encaissement = 'en_attente',
    date_encaissement = NULL
  WHERE id = p_vente_id;

  RETURN jsonb_build_object('ok', true, 'id', p_vente_id, 'quantite_reversee', v_reverse);
END;
$$;