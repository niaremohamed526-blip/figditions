CREATE OR REPLACE FUNCTION public.annuler_mouvement_stock(p_mouvement_id uuid, p_raison text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ent uuid;
  v_mv public.mouvements_stock;
  v_si public.stock_interne;
  v_ext public.stocks;
  v_q integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = v_uid;
  IF v_ent IS NULL THEN RAISE EXCEPTION 'Profil sans entreprise'; END IF;

  SELECT * INTO v_mv FROM public.mouvements_stock
   WHERE id = p_mouvement_id AND entreprise_id = v_ent FOR UPDATE;
  IF v_mv.id IS NULL THEN RAISE EXCEPTION 'Mouvement introuvable'; END IF;
  IF COALESCE(v_mv.statut_annulation, 'active') = 'annulee' THEN
    RAISE EXCEPTION 'Ce mouvement est déjà annulé';
  END IF;
  IF v_mv.type_mouvement = 'vente_directe' THEN
    RAISE EXCEPTION 'Une vente libre s''annule depuis Finances › Ventes (bouton Annuler), afin de reverser aussi le chiffre d''affaires et les droits d''auteur.';
  END IF;
  IF v_mv.type_mouvement = 'ajustement' THEN
    RAISE EXCEPTION 'Un ajustement manuel ne peut pas être annulé automatiquement. Enregistrez un nouvel ajustement avec la valeur correcte.';
  END IF;

  v_q := GREATEST(0, COALESCE(v_mv.quantite, 0));

  SELECT * INTO v_si FROM public.stock_interne
   WHERE entreprise_id = v_ent AND manuscrit_id = v_mv.manuscrit_id FOR UPDATE;
  IF v_si.id IS NULL THEN RAISE EXCEPTION 'Stock interne introuvable pour ce livre'; END IF;

  IF v_mv.type_mouvement = 'impression' THEN
    IF v_q > COALESCE(v_si.quantite_disponible, 0) THEN
      RAISE EXCEPTION 'Impossible : seulement % exemplaire(s) encore disponible(s) sur les % reçus.', v_si.quantite_disponible, v_q;
    END IF;
    UPDATE public.stock_interne SET
      quantite_imprimee = GREATEST(0, COALESCE(quantite_imprimee, 0) - v_q),
      quantite_disponible = GREATEST(0, COALESCE(quantite_disponible, 0) - v_q),
      derniere_mise_a_jour = now()
    WHERE id = v_si.id;

  ELSIF v_mv.type_mouvement = 'transfert_librairie' THEN
    IF v_mv.destination IS NOT NULL THEN
      SELECT * INTO v_ext FROM public.stocks
       WHERE entreprise_id = v_ent AND manuscrit_id = v_mv.manuscrit_id
         AND lower(btrim(COALESCE(librairie_nom, ''))) = lower(btrim(v_mv.destination))
       ORDER BY created_at LIMIT 1 FOR UPDATE;
      IF v_ext.id IS NOT NULL THEN
        IF v_q > COALESCE(v_ext.exemplaires_restants, 0) THEN
          RAISE EXCEPTION 'Impossible : la librairie % n''a plus que % exemplaire(s) en rayon (lot de %).', v_ext.librairie_nom, v_ext.exemplaires_restants, v_q;
        END IF;
        UPDATE public.stocks SET
          exemplaires_deposes = GREATEST(0, COALESCE(exemplaires_deposes, 0) - v_q),
          exemplaires_restants = GREATEST(0, COALESCE(exemplaires_restants, 0) - v_q),
          exemplaires_total = GREATEST(0, COALESCE(exemplaires_total, 0) - v_q)
        WHERE id = v_ext.id;
      END IF;
    END IF;
    UPDATE public.stock_interne SET
      quantite_disponible = COALESCE(quantite_disponible, 0) + v_q,
      quantite_transferee_librairies = GREATEST(0, COALESCE(quantite_transferee_librairies, 0) - v_q),
      derniere_mise_a_jour = now()
    WHERE id = v_si.id;

  ELSIF v_mv.type_mouvement = 'evenement' THEN
    UPDATE public.stock_interne SET
      quantite_disponible = COALESCE(quantite_disponible, 0) + v_q,
      quantite_exposee_evenements = GREATEST(0, COALESCE(quantite_exposee_evenements, 0) - v_q),
      derniere_mise_a_jour = now()
    WHERE id = v_si.id;

  ELSIF v_mv.type_mouvement = 'perte' THEN
    UPDATE public.stock_interne SET
      quantite_disponible = COALESCE(quantite_disponible, 0) + v_q,
      derniere_mise_a_jour = now()
    WHERE id = v_si.id;

  ELSIF v_mv.type_mouvement = 'retour_librairie' THEN
    IF v_q > COALESCE(v_si.quantite_disponible, 0) THEN
      RAISE EXCEPTION 'Impossible : seulement % exemplaire(s) disponible(s) en stock interne (retour de %).', v_si.quantite_disponible, v_q;
    END IF;
    UPDATE public.stock_interne SET
      quantite_disponible = GREATEST(0, COALESCE(quantite_disponible, 0) - v_q),
      quantite_transferee_librairies = COALESCE(quantite_transferee_librairies, 0) + v_q,
      derniere_mise_a_jour = now()
    WHERE id = v_si.id;

  ELSE
    RAISE EXCEPTION 'Type de mouvement non annulable : %', v_mv.type_mouvement;
  END IF;

  UPDATE public.mouvements_stock SET
    statut_annulation = 'annulee',
    raison_annulation = NULLIF(btrim(COALESCE(p_raison, '')), ''),
    annulee_par = v_uid,
    annulee_le = now()
  WHERE id = p_mouvement_id;

  SELECT * INTO v_si FROM public.stock_interne WHERE id = v_si.id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_mouvement_id,
    'type', v_mv.type_mouvement,
    'quantite_reversee', v_q,
    'quantite_disponible', v_si.quantite_disponible
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.annuler_depot_batch(p_batch_id uuid, p_raison text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ent uuid;
  v_b public.depot_batches;
  v_ext public.stocks;
  v_si public.stock_interne;
  v_q integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = v_uid;
  IF v_ent IS NULL THEN RAISE EXCEPTION 'Profil sans entreprise'; END IF;

  SELECT * INTO v_b FROM public.depot_batches
   WHERE id = p_batch_id AND entreprise_id = v_ent FOR UPDATE;
  IF v_b.id IS NULL THEN RAISE EXCEPTION 'Dépôt introuvable'; END IF;
  IF COALESCE(v_b.statut_annulation, 'active') = 'annulee' THEN
    RAISE EXCEPTION 'Ce dépôt est déjà annulé';
  END IF;

  v_q := GREATEST(0, COALESCE(v_b.quantite_deposee, 0));

  IF v_b.stock_id IS NOT NULL THEN
    SELECT * INTO v_ext FROM public.stocks
     WHERE id = v_b.stock_id AND entreprise_id = v_ent FOR UPDATE;
  END IF;
  IF v_ext.id IS NULL THEN
    SELECT * INTO v_ext FROM public.stocks
     WHERE entreprise_id = v_ent AND manuscrit_id = v_b.manuscrit_id
       AND lower(btrim(COALESCE(librairie_nom, ''))) = lower(btrim(COALESCE(v_b.librairie_nom, '')))
     ORDER BY created_at LIMIT 1 FOR UPDATE;
  END IF;

  IF v_ext.id IS NULL THEN
    RAISE EXCEPTION 'Ligne de stock librairie introuvable pour ce dépôt';
  END IF;
  IF v_q > COALESCE(v_ext.exemplaires_restants, 0) THEN
    RAISE EXCEPTION 'Impossible : la librairie n''a plus que % exemplaire(s) en rayon (lot de %). Les exemplaires ont probablement déjà été vendus.', v_ext.exemplaires_restants, v_q;
  END IF;

  UPDATE public.stocks SET
    exemplaires_deposes = GREATEST(0, COALESCE(exemplaires_deposes, 0) - v_q),
    exemplaires_restants = GREATEST(0, COALESCE(exemplaires_restants, 0) - v_q),
    exemplaires_total = GREATEST(0, COALESCE(exemplaires_total, 0) - v_q)
  WHERE id = v_ext.id;

  IF COALESCE(v_b.provenance, 'interne') <> 'hors_stock' THEN
    SELECT * INTO v_si FROM public.stock_interne
     WHERE entreprise_id = v_ent AND manuscrit_id = v_b.manuscrit_id FOR UPDATE;
    IF v_si.id IS NOT NULL THEN
      UPDATE public.stock_interne SET
        quantite_disponible = COALESCE(quantite_disponible, 0) + v_q,
        quantite_transferee_librairies = GREATEST(0, COALESCE(quantite_transferee_librairies, 0) - v_q),
        derniere_mise_a_jour = now()
      WHERE id = v_si.id;
    END IF;
  END IF;

  UPDATE public.depot_batches SET
    statut_annulation = 'annulee',
    raison_annulation = NULLIF(btrim(COALESCE(p_raison, '')), ''),
    annulee_par = v_uid,
    annulee_le = now()
  WHERE id = p_batch_id;

  SELECT * INTO v_ext FROM public.stocks WHERE id = v_ext.id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_batch_id,
    'quantite_reversee', v_q,
    'remis_en_stock_interne', COALESCE(v_b.provenance, 'interne') <> 'hors_stock',
    'total_restants', v_ext.exemplaires_restants,
    'total_deposes', v_ext.exemplaires_deposes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.annuler_mouvement_stock(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.annuler_depot_batch(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_mouvement_stock(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_depot_batch(uuid, text) TO authenticated;