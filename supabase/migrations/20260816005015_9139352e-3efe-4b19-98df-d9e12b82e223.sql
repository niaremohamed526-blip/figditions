
-- 1) Atomic depot upsert: keeps warehouse stock and bookstore depot coherent
CREATE OR REPLACE FUNCTION public.upsert_depot_librairie(
  p_stock_id uuid,
  p_manuscrit_id uuid,
  p_librairie_nom text,
  p_librairie_adresse text,
  p_deposes integer,
  p_vendus integer,
  p_prix numeric,
  p_derniere_visite date DEFAULT NULL,
  p_taux_commission numeric DEFAULT 20,
  p_applique_droits boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ent uuid;
  v_row public.stocks;
  v_old_dep integer := 0;
  v_delta integer;
  v_si public.stock_interne;
  v_dep integer := GREATEST(0, COALESCE(p_deposes, 0));
  v_ven integer := GREATEST(0, COALESCE(p_vendus, 0));
  v_taux numeric := LEAST(100, GREATEST(0, COALESCE(p_taux_commission, 20)));
BEGIN
  v_ent := private.current_entreprise_id();
  IF v_ent IS NULL THEN RAISE EXCEPTION 'Aucune entreprise associée à votre compte'; END IF;
  IF v_ven > v_dep THEN
    RAISE EXCEPTION 'Exemplaires vendus (%) supérieurs aux exemplaires déposés (%)', v_ven, v_dep;
  END IF;

  IF p_stock_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.stocks WHERE id = p_stock_id AND entreprise_id = v_ent FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Dépôt introuvable'; END IF;
    v_old_dep := COALESCE(v_row.exemplaires_deposes, 0);
    IF v_ven < COALESCE(v_row.exemplaires_vendus, 0) THEN
      RAISE EXCEPTION 'Impossible de réduire les exemplaires vendus (historique de ventes déjà enregistré)';
    END IF;
  END IF;

  v_delta := v_dep - v_old_dep;

  -- Warehouse side (only when a stock_interne record exists for this book)
  SELECT * INTO v_si FROM public.stock_interne
   WHERE manuscrit_id = p_manuscrit_id AND entreprise_id = v_ent FOR UPDATE;

  IF v_si.id IS NOT NULL AND v_delta <> 0 THEN
    IF v_delta > 0 THEN
      IF v_delta > v_si.quantite_disponible THEN
        RAISE EXCEPTION 'Stock entrepôt insuffisant. Disponible: % exemplaire(s), demandé: %',
          v_si.quantite_disponible, v_delta;
      END IF;
      UPDATE public.stock_interne SET
        quantite_disponible = quantite_disponible - v_delta,
        quantite_transferee_librairies = quantite_transferee_librairies + v_delta,
        derniere_mise_a_jour = now()
      WHERE id = v_si.id;
    ELSE
      UPDATE public.stock_interne SET
        quantite_disponible = quantite_disponible + (-v_delta),
        quantite_transferee_librairies = GREATEST(0, quantite_transferee_librairies + v_delta),
        derniere_mise_a_jour = now()
      WHERE id = v_si.id;
    END IF;

    INSERT INTO public.mouvements_stock(entreprise_id, stock_interne_id, manuscrit_id,
      type_mouvement, quantite, destination, notes, effectue_par, date_mouvement)
    VALUES (v_ent, v_si.id, p_manuscrit_id,
      CASE WHEN v_delta > 0 THEN 'transfert_librairie' ELSE 'retour_librairie' END,
      ABS(v_delta), NULLIF(btrim(COALESCE(p_librairie_nom, '')), ''),
      'Dépôt librairie (synchronisation automatique)', auth.uid(), COALESCE(p_derniere_visite, CURRENT_DATE));
  END IF;

  IF v_row.id IS NULL THEN
    -- insert with 0 sold first so the sale trigger fires on the update below
    INSERT INTO public.stocks(entreprise_id, manuscrit_id, librairie_nom, librairie_adresse,
      exemplaires_deposes, exemplaires_vendus, exemplaires_restants, exemplaires_total,
      prix_unitaire_fcfa, derniere_visite, taux_commission_pct, applique_droits_auteur)
    VALUES (v_ent, p_manuscrit_id, NULLIF(btrim(COALESCE(p_librairie_nom,'')),''), NULLIF(btrim(COALESCE(p_librairie_adresse,'')),''),
      v_dep, 0, v_dep, v_dep, COALESCE(p_prix, 0), p_derniere_visite, v_taux, COALESCE(p_applique_droits, true))
    RETURNING * INTO v_row;
  END IF;

  UPDATE public.stocks SET
    librairie_nom = NULLIF(btrim(COALESCE(p_librairie_nom,'')),''),
    librairie_adresse = NULLIF(btrim(COALESCE(p_librairie_adresse,'')),''),
    exemplaires_deposes = v_dep,
    exemplaires_vendus = v_ven,
    exemplaires_restants = GREATEST(0, v_dep - v_ven),
    exemplaires_total = v_dep,
    prix_unitaire_fcfa = COALESCE(p_prix, 0),
    derniere_visite = p_derniere_visite,
    taux_commission_pct = v_taux,
    applique_droits_auteur = COALESCE(p_applique_droits, true)
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'exemplaires_deposes', v_row.exemplaires_deposes,
    'exemplaires_vendus', v_row.exemplaires_vendus,
    'exemplaires_restants', v_row.exemplaires_restants,
    'delta_entrepot', -v_delta
  );
END; $$;

REVOKE ALL ON FUNCTION public.upsert_depot_librairie(uuid,uuid,text,text,integer,integer,numeric,date,numeric,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_depot_librairie(uuid,uuid,text,text,integer,integer,numeric,date,numeric,boolean) TO authenticated;

-- 2) Impossible-value guards
ALTER TABLE public.stocks
  DROP CONSTRAINT IF EXISTS stocks_non_negatifs,
  DROP CONSTRAINT IF EXISTS stocks_taux_commission_valide;
ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_non_negatifs CHECK (
    exemplaires_deposes >= 0 AND exemplaires_vendus >= 0 AND exemplaires_restants >= 0
  ),
  ADD CONSTRAINT stocks_taux_commission_valide CHECK (
    taux_commission_pct >= 0 AND taux_commission_pct <= 100
  );

ALTER TABLE public.stock_interne
  DROP CONSTRAINT IF EXISTS stock_interne_non_negatif;
ALTER TABLE public.stock_interne
  ADD CONSTRAINT stock_interne_non_negatif CHECK (
    quantite_imprimee >= 0 AND quantite_disponible >= 0 AND quantite_reservee >= 0
    AND quantite_transferee_librairies >= 0 AND quantite_vendue_directement >= 0
    AND quantite_exposee_evenements >= 0
  );

ALTER TABLE public.ventes
  DROP CONSTRAINT IF EXISTS ventes_montants_coherents;
ALTER TABLE public.ventes
  ADD CONSTRAINT ventes_montants_coherents CHECK (
    quantite_vendue > 0
    AND montant_total_fcfa >= 0
    AND droits_auteur_fcfa >= 0
    AND commission_librairie_fcfa >= 0
    AND droits_auteur_fcfa <= montant_total_fcfa
    AND commission_librairie_fcfa <= montant_total_fcfa
  );
