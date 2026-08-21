ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS prix_catalogue_fcfa numeric;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS remise_fcfa numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_stock_mouvement(p_manuscrit_id uuid, p_type text, p_quantite integer, p_destination text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_date date DEFAULT CURRENT_DATE, p_stock_externe_id uuid DEFAULT NULL::uuid, p_provenance text DEFAULT NULL::text, p_prix_unitaire numeric DEFAULT NULL::numeric, p_valeur_absolue integer DEFAULT NULL::integer, p_prix_catalogue numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ent uuid;
  v_stock public.stock_interne;
  v_ext public.stocks;
  v_new_dispo integer;
  v_prix numeric;
  v_prix_vente numeric;
  v_remise numeric;
  v_auteur uuid;
  v_pct numeric;
  v_montant numeric;
  v_max integer;
  v_mid uuid;
BEGIN
  v_ent := private.current_entreprise_id();
  IF v_ent IS NULL THEN
    RAISE EXCEPTION 'Aucune entreprise associée à votre compte';
  END IF;
  IF p_quantite IS NULL OR (p_quantite <= 0 AND p_type <> 'ajustement') THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  SELECT * INTO v_stock FROM public.stock_interne
   WHERE manuscrit_id = p_manuscrit_id AND entreprise_id = v_ent
   FOR UPDATE;
  IF v_stock.id IS NULL THEN
    RAISE EXCEPTION 'Ce livre n''a pas encore de stock interne';
  END IF;

  IF p_type = 'vente_directe' AND p_prix_catalogue IS NOT NULL AND p_prix_catalogue > 0 THEN
    -- Vente avec remise : le prix standard du livre reste le prix catalogue,
    -- le prix remisé ne s'applique qu'à cette vente.
    UPDATE public.stock_interne SET prix_vente_direct_fcfa = p_prix_catalogue WHERE id = v_stock.id;
    v_stock.prix_vente_direct_fcfa := p_prix_catalogue;
  ELSIF p_prix_unitaire IS NOT NULL AND p_prix_unitaire > 0 THEN
    UPDATE public.stock_interne SET prix_vente_direct_fcfa = p_prix_unitaire WHERE id = v_stock.id;
    v_stock.prix_vente_direct_fcfa := p_prix_unitaire;
  END IF;

  -- Validation des sorties de stock
  IF p_type IN ('transfert_librairie','vente_directe','evenement','perte')
     AND p_quantite > v_stock.quantite_disponible THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible: % exemplaires. Vous essayez de soustraire: % exemplaires.',
      v_stock.quantite_disponible, p_quantite;
  END IF;

  IF p_type = 'impression' THEN
    UPDATE public.stock_interne SET
      quantite_imprimee = quantite_imprimee + p_quantite,
      quantite_disponible = quantite_disponible + p_quantite,
      derniere_mise_a_jour = now()
    WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;

  ELSIF p_type = 'transfert_librairie' THEN
    IF p_destination IS NULL OR btrim(p_destination) = '' THEN
      RAISE EXCEPTION 'Destination requise';
    END IF;
    UPDATE public.stock_interne SET
      quantite_disponible = quantite_disponible - p_quantite,
      quantite_transferee_librairies = quantite_transferee_librairies + p_quantite,
      derniere_mise_a_jour = now()
    WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;

    v_prix := COALESCE(NULLIF(v_stock.prix_vente_direct_fcfa, 0), 0);
    SELECT * INTO v_ext FROM public.stocks
      WHERE entreprise_id = v_ent AND manuscrit_id = p_manuscrit_id
        AND lower(btrim(librairie_nom)) = lower(btrim(p_destination))
      ORDER BY created_at LIMIT 1
      FOR UPDATE;
    IF v_ext.id IS NOT NULL THEN
      UPDATE public.stocks SET
        exemplaires_deposes = exemplaires_deposes + p_quantite,
        exemplaires_restants = exemplaires_restants + p_quantite,
        exemplaires_total = exemplaires_total + p_quantite,
        prix_unitaire_fcfa = CASE WHEN COALESCE(prix_unitaire_fcfa,0) = 0 THEN v_prix ELSE prix_unitaire_fcfa END
      WHERE id = v_ext.id;
    ELSE
      INSERT INTO public.stocks(entreprise_id, manuscrit_id, librairie_nom,
        exemplaires_deposes, exemplaires_vendus, exemplaires_restants, exemplaires_total, prix_unitaire_fcfa)
      VALUES (v_ent, p_manuscrit_id, btrim(p_destination),
        p_quantite, 0, p_quantite, p_quantite, v_prix);
    END IF;

  ELSIF p_type = 'vente_directe' THEN
    UPDATE public.stock_interne SET
      quantite_disponible = quantite_disponible - p_quantite,
      quantite_vendue_directement = quantite_vendue_directement + p_quantite,
      derniere_mise_a_jour = now()
    WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;

    v_prix := COALESCE(v_stock.prix_vente_direct_fcfa, 0);
    v_prix_vente := CASE WHEN p_prix_unitaire IS NOT NULL AND p_prix_unitaire > 0 THEN p_prix_unitaire ELSE v_prix END;
    v_remise := CASE WHEN v_prix > v_prix_vente THEN round((v_prix - v_prix_vente) * p_quantite) ELSE 0 END;
    IF v_prix_vente > 0 THEN
      SELECT auteur_id INTO v_auteur FROM public.manuscrits WHERE id = p_manuscrit_id;
      v_montant := p_quantite * v_prix_vente;
      v_pct := public.pourcentage_droits_pour(p_manuscrit_id, v_auteur);
      INSERT INTO public.ventes(entreprise_id, manuscrit_id, auteur_id,
        quantite_vendue, prix_unitaire_fcfa, montant_total_fcfa, montant,
        droits_auteur_fcfa, commission_librairie_fcfa, canal_vente, statut_paiement, date_vente,
        prix_catalogue_fcfa, remise_fcfa)
      VALUES (v_ent, p_manuscrit_id, v_auteur,
        p_quantite, v_prix_vente, v_montant, v_montant,
        round(v_montant * v_pct / 100), 0, 'interne', 'en_attente', p_date,
        CASE WHEN v_remise > 0 THEN v_prix ELSE NULL END, v_remise);
    END IF;

  ELSIF p_type = 'evenement' THEN
    UPDATE public.stock_interne SET
      quantite_disponible = quantite_disponible - p_quantite,
      quantite_exposee_evenements = quantite_exposee_evenements + p_quantite,
      derniere_mise_a_jour = now()
    WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;

  ELSIF p_type = 'perte' THEN
    UPDATE public.stock_interne SET
      quantite_disponible = quantite_disponible - p_quantite,
      derniere_mise_a_jour = now()
    WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;

  ELSIF p_type = 'retour_librairie' THEN
    IF COALESCE(p_provenance,'librairie') = 'librairie' THEN
      IF p_stock_externe_id IS NOT NULL THEN
        SELECT * INTO v_ext FROM public.stocks
          WHERE id = p_stock_externe_id AND entreprise_id = v_ent FOR UPDATE;
        IF v_ext.id IS NULL THEN
          RAISE EXCEPTION 'Librairie de provenance introuvable';
        END IF;
        v_max := GREATEST(0, v_ext.exemplaires_restants);
        IF p_quantite > v_max THEN
          RAISE EXCEPTION 'Maximum retournable : % exemplaire(s)', v_max;
        END IF;
        UPDATE public.stocks SET
          exemplaires_deposes = GREATEST(0, exemplaires_deposes - p_quantite),
          exemplaires_restants = GREATEST(0, exemplaires_restants - p_quantite),
          exemplaires_total = GREATEST(0, exemplaires_total - p_quantite)
        WHERE id = v_ext.id;
      END IF;
      IF p_stock_externe_id IS NOT NULL AND COALESCE(v_ext.provenance, 'interne') = 'hors_stock' THEN
        -- Dépôt direct « hors stock interne » : les livres n'ont jamais été prélevés
        -- de l'entrepôt ; le retour les y fait entrer sans toucher aux transferts.
        UPDATE public.stock_interne SET
          quantite_disponible = quantite_disponible + p_quantite,
          derniere_mise_a_jour = now()
        WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;
      ELSE
        UPDATE public.stock_interne SET
          quantite_disponible = quantite_disponible + p_quantite,
          quantite_transferee_librairies = GREATEST(0, quantite_transferee_librairies - p_quantite),
          derniere_mise_a_jour = now()
        WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;
      END IF;
    ELSIF p_provenance IN ('evenement','exposition') THEN
      IF p_quantite > v_stock.quantite_exposee_evenements THEN
        RAISE EXCEPTION 'Maximum retournable : % exemplaire(s)', v_stock.quantite_exposee_evenements;
      END IF;
      UPDATE public.stock_interne SET
        quantite_disponible = quantite_disponible + p_quantite,
        quantite_exposee_evenements = GREATEST(0, quantite_exposee_evenements - p_quantite),
        derniere_mise_a_jour = now()
      WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;
    ELSE
      UPDATE public.stock_interne SET
        quantite_disponible = quantite_disponible + p_quantite,
        derniere_mise_a_jour = now()
      WHERE id = v_stock.id RETURNING quantite_disponible INTO v_new_dispo;
    END IF;

  ELSIF p_type = 'ajustement' THEN
    v_new_dispo := GREATEST(0, COALESCE(p_valeur_absolue, p_quantite));
    UPDATE public.stock_interne SET
      quantite_disponible = v_new_dispo,
      quantite_imprimee = GREATEST(quantite_imprimee, v_new_dispo),
      derniere_mise_a_jour = now()
    WHERE id = v_stock.id;

  ELSE
    RAISE EXCEPTION 'Type de mouvement inconnu : %', p_type;
  END IF;

  INSERT INTO public.mouvements_stock(entreprise_id, stock_interne_id, manuscrit_id,
    type_mouvement, quantite, destination, notes, effectue_par, date_mouvement)
  VALUES (v_ent, v_stock.id, p_manuscrit_id, p_type,
    CASE WHEN p_type = 'ajustement' THEN ABS(v_new_dispo - v_stock.quantite_disponible) ELSE p_quantite END,
    NULLIF(btrim(COALESCE(p_destination,'')),''), NULLIF(btrim(COALESCE(p_notes,'')),''),
    auth.uid(), COALESCE(p_date, CURRENT_DATE))
  RETURNING id INTO v_mid;

  SELECT * INTO v_stock FROM public.stock_interne WHERE id = v_stock.id;

  RETURN jsonb_build_object(
    'mouvement_id', v_mid,
    'stock_interne_id', v_stock.id,
    'quantite_disponible', v_stock.quantite_disponible,
    'quantite_imprimee', v_stock.quantite_imprimee,
    'seuil_alerte', v_stock.seuil_alerte
  );
END;
$function$;