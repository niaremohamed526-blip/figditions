DROP FUNCTION IF EXISTS public.record_vente_libre_panier(jsonb, numeric, date, text, text);

CREATE OR REPLACE FUNCTION public.record_vente_libre_panier(
  p_lignes jsonb,
  p_remise_pct numeric DEFAULT 0,
  p_date date DEFAULT CURRENT_DATE,
  p_client text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_paiement_recu boolean DEFAULT true
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ent uuid;
  v_panier uuid := gen_random_uuid();
  v_remise numeric := GREATEST(0, LEAST(100, COALESCE(p_remise_pct, 0)));
  v_date date := COALESCE(p_date, CURRENT_DATE);
  v_paye boolean := COALESCE(p_paiement_recu, true);
  v_ligne jsonb;
  v_mid uuid;
  v_qte integer;
  v_prix numeric;
  v_stock public.stock_interne;
  v_auteur uuid;
  v_pct numeric;
  v_avant numeric;
  v_montant numeric;
  v_titre text;
  v_num text;
  v_seq integer;
  v_total numeric := 0;
  v_total_avant numeric := 0;
  v_total_droits numeric := 0;
  v_nb integer := 0;
BEGIN
  v_ent := private.current_entreprise_id();
  IF v_ent IS NULL THEN
    RAISE EXCEPTION 'Aucune entreprise associée à votre compte';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Aucun livre dans le panier';
  END IF;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_qte := COALESCE((v_ligne->>'quantite')::integer, 0);
    v_prix := COALESCE((v_ligne->>'prix_unitaire')::numeric, 0);
    IF v_qte <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour « % »', COALESCE(v_ligne->>'titre', 'livre');
    END IF;
    IF v_prix <= 0 THEN
      RAISE EXCEPTION 'Prix invalide pour « % »', COALESCE(v_ligne->>'titre', 'livre');
    END IF;
    SELECT * INTO v_stock FROM public.stock_interne
      WHERE manuscrit_id = (v_ligne->>'manuscrit_id')::uuid AND entreprise_id = v_ent
      FOR UPDATE;
    IF v_stock.id IS NULL THEN
      RAISE EXCEPTION 'Aucun stock interne pour « % »', COALESCE(v_ligne->>'titre', 'livre');
    END IF;
    IF v_qte > v_stock.quantite_disponible THEN
      RAISE EXCEPTION 'Stock insuffisant pour « % » : % disponible(s)',
        COALESCE(v_ligne->>'titre', 'livre'), v_stock.quantite_disponible;
    END IF;
  END LOOP;

  SELECT COUNT(DISTINCT panier_id) + 1 INTO v_seq
    FROM public.ventes
   WHERE entreprise_id = v_ent
     AND panier_id IS NOT NULL
     AND EXTRACT(YEAR FROM date_vente) = EXTRACT(YEAR FROM v_date);
  v_num := 'FACT-' || TO_CHAR(v_date, 'YYYY') || '-' || LPAD(v_seq::text, 4, '0');

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_qte := (v_ligne->>'quantite')::integer;
    v_prix := (v_ligne->>'prix_unitaire')::numeric;
    v_titre := COALESCE(v_ligne->>'titre', 'livre');

    SELECT * INTO v_stock FROM public.stock_interne
      WHERE manuscrit_id = (v_ligne->>'manuscrit_id')::uuid AND entreprise_id = v_ent
      FOR UPDATE;

    UPDATE public.stock_interne SET
      quantite_disponible = quantite_disponible - v_qte,
      quantite_vendue_directement = quantite_vendue_directement + v_qte,
      prix_vente_direct_fcfa = CASE WHEN COALESCE(prix_vente_direct_fcfa,0) = 0 THEN v_prix ELSE prix_vente_direct_fcfa END,
      derniere_mise_a_jour = now()
    WHERE id = v_stock.id;

    v_avant := ROUND(v_qte * v_prix);
    v_montant := ROUND(v_avant * (1 - v_remise / 100));

    SELECT auteur_id INTO v_auteur FROM public.manuscrits WHERE id = (v_ligne->>'manuscrit_id')::uuid;
    v_pct := public.pourcentage_droits_pour((v_ligne->>'manuscrit_id')::uuid, v_auteur);

    INSERT INTO public.ventes(entreprise_id, manuscrit_id, auteur_id,
      quantite_vendue, prix_unitaire_fcfa, montant_total_fcfa, montant,
      montant_avant_remise_fcfa, remise_pct, remise_fcfa, prix_catalogue_fcfa,
      droits_auteur_fcfa, commission_librairie_fcfa, canal_vente, statut_paiement, date_vente,
      statut_encaissement, montant_encaisse_fcfa, date_encaissement,
      panier_id, facture_numero, client_nom)
    VALUES (v_ent, (v_ligne->>'manuscrit_id')::uuid, v_auteur,
      v_qte, v_prix, v_montant, v_montant,
      v_avant, v_remise, GREATEST(0, v_avant - v_montant),
      CASE WHEN v_remise > 0 THEN v_prix ELSE NULL END,
      ROUND(v_montant * v_pct / 100), 0, 'interne', 'en_attente', v_date,
      CASE WHEN v_paye THEN 'encaisse' ELSE 'en_attente' END,
      CASE WHEN v_paye THEN v_montant ELSE 0 END,
      CASE WHEN v_paye THEN v_date ELSE NULL END,
      v_panier, v_num, NULLIF(btrim(COALESCE(p_client, '')), ''));

    INSERT INTO public.mouvements_stock(entreprise_id, stock_interne_id, manuscrit_id,
      type_mouvement, quantite, notes, effectue_par, date_mouvement)
    VALUES (v_ent, v_stock.id, (v_ligne->>'manuscrit_id')::uuid, 'vente_directe', v_qte,
      NULLIF(btrim(CONCAT_WS(' · ', NULLIF(btrim(COALESCE(p_notes,'')),''), 'Facture ' || v_num)), ''),
      auth.uid(), v_date)
    RETURNING id INTO v_mid;

    v_nb := v_nb + 1;
    v_total := v_total + v_montant;
    v_total_avant := v_total_avant + v_avant;
    v_total_droits := v_total_droits + ROUND(v_montant * v_pct / 100);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'panier_id', v_panier,
    'facture_numero', v_num,
    'nb_lignes', v_nb,
    'total_fcfa', v_total,
    'total_avant_remise_fcfa', v_total_avant,
    'total_droits_fcfa', v_total_droits,
    'encaisse', v_paye
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_vente_libre_panier(jsonb, numeric, date, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_vente_libre_panier(jsonb, numeric, date, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_vente_libre_panier(jsonb, numeric, date, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_vente_libre_panier(jsonb, numeric, date, text, text, boolean) TO service_role;