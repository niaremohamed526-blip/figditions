-- ============================================================
-- SYSTÈME D'ANNULATION DES VENTES
-- ============================================================

-- 1) VENTES
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS statut_annulation text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS raison_annulation text,
  ADD COLUMN IF NOT EXISTS annulee_par uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS annulee_le timestamp with time zone;

-- 2) MOUVEMENTS DE STOCK
ALTER TABLE public.mouvements_stock
  ADD COLUMN IF NOT EXISTS statut_annulation text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS raison_annulation text,
  ADD COLUMN IF NOT EXISTS annulee_par uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS annulee_le timestamp with time zone;

-- 3) DÉPÔTS EN LIBRAIRIE (lots)
ALTER TABLE public.depot_batches
  ADD COLUMN IF NOT EXISTS statut_annulation text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS raison_annulation text,
  ADD COLUMN IF NOT EXISTS annulee_par uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS annulee_le timestamp with time zone;

-- 4) PAIEMENTS DE ROYALTIES
ALTER TABLE public.paiements_royalties
  ADD COLUMN IF NOT EXISTS statut_annulation text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS raison_annulation text,
  ADD COLUMN IF NOT EXISTS annulee_par uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS annulee_le timestamp with time zone;

-- 5) RPC : annuler une vente (restaure le stock + réinitialise encaissement)
CREATE OR REPLACE FUNCTION public.annuler_vente(
  p_vente_id uuid,
  p_raison text DEFAULT NULL
)
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
  IF v_vente.statut_paiement = 'paye' THEN
    RAISE EXCEPTION 'Les droits d''auteur de cette vente ont déjà été payés. Annulez d''abord le paiement de royalties correspondant.';
  END IF;

  v_reverse := COALESCE(v_vente.quantite_vendue, 0);

  -- Restauration du stock librairie
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

  -- Restauration du stock interne
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

  -- Marquage de la vente comme annulée + réinitialisation encaissement
  UPDATE public.ventes SET
    statut_annulation = 'annulee',
    raison_annulation = NULLIF(btrim(COALESCE(p_raison, '')), ''),
    annulee_par = v_uid,
    annulee_le = now(),
    montant_encaisse_fcfa = 0,
    statut_encaissement = 'en_attente',
    date_encaissement = NULL
  WHERE id = p_vente_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_vente_id,
    'quantite_reversee', v_reverse
  );
END;
$$;

-- 6) Empêcher le paiement de royalties sur une vente annulée
CREATE OR REPLACE FUNCTION public.payer_royalties_auteur(
  p_vente_ids uuid[],
  p_methode text,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ent uuid;
  v_nom text;
  v_count int;
  v_montant numeric;
  v_auteur uuid;
  v_auteur_nom text;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_next int;
  v_numero text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT entreprise_id, full_name INTO v_ent, v_nom FROM public.profiles WHERE id = v_uid;
  IF v_ent IS NULL THEN RAISE EXCEPTION 'Profil sans entreprise'; END IF;
  IF p_vente_ids IS NULL OR array_length(p_vente_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Aucune vente sélectionnée';
  END IF;
  IF p_methode NOT IN ('especes','orange_money','wave','moov_money','virement','cheque') THEN
    RAISE EXCEPTION 'Méthode de paiement invalide';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ventes
    WHERE id = ANY(p_vente_ids)
      AND (entreprise_id <> v_ent OR statut_paiement <> 'en_attente' OR statut_annulation = 'annulee')
  ) THEN
    RAISE EXCEPTION 'Certaines ventes sont introuvables, déjà payées ou annulées';
  END IF;

  WITH upd AS (
    UPDATE public.ventes SET statut_paiement = 'paye'
    WHERE id = ANY(p_vente_ids)
    RETURNING droits_auteur_fcfa
  )
  SELECT COUNT(*), COALESCE(SUM(droits_auteur_fcfa), 0) INTO v_count, v_montant FROM upd;

  SELECT auteur_id INTO v_auteur FROM public.ventes
   WHERE id = ANY(p_vente_ids) AND auteur_id IS NOT NULL LIMIT 1;
  SELECT nom_complet INTO v_auteur_nom FROM public.auteurs WHERE id = v_auteur;
  IF v_auteur_nom IS NULL THEN
    SELECT m.auteur INTO v_auteur_nom
      FROM public.ventes v JOIN public.manuscrits m ON m.id = v.manuscrit_id
     WHERE v.id = ANY(p_vente_ids) LIMIT 1;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('quittance:' || v_ent::text || ':' || v_year::text, 0));
  SELECT COALESCE(MAX(CAST(regexp_replace(numero, '^QUT-\d{4}-', '') AS integer)), 0) + 1
    INTO v_next
    FROM public.paiements_royalties
   WHERE entreprise_id = v_ent AND annee = v_year;
  v_numero := 'QUT-' || v_year::text || '-' || lpad(v_next::text, 4, '0');

  INSERT INTO public.paiements_royalties(
    entreprise_id, numero, annee, auteur_id, auteur_nom, vente_ids,
    montant_fcfa, methode, reference, notes, paye_par, paye_par_nom
  ) VALUES (
    v_ent, v_numero, v_year, v_auteur, COALESCE(v_auteur_nom, 'Auteur'), p_vente_ids,
    v_montant, p_methode, NULLIF(btrim(COALESCE(p_reference,'')),''), NULLIF(btrim(COALESCE(p_notes,'')),''), v_uid, v_nom
  ) RETURNING id INTO v_id;

  PERFORM public.fn_notify(
    v_ent, 'royalty_paye', '💰 Royalties payées',
    COALESCE(v_auteur_nom, 'Auteur') || ' — ' || to_char(v_montant, 'FM999G999G999') || ' FCFA (' || v_numero || ')',
    '/finances', jsonb_build_object('paiement_id', v_id)
  );

  RETURN jsonb_build_object(
    'ok', true, 'id', v_id, 'numero', v_numero,
    'montant', v_montant, 'auteur_nom', COALESCE(v_auteur_nom, 'Auteur'),
    'methode', p_methode, 'reference', p_reference, 'count', v_count
  );
END;
$$;

-- 7) Empêcher l'encaissement d'une vente annulée
CREATE OR REPLACE FUNCTION public.enregistrer_encaissement(
  p_vente_id uuid,
  p_montant numeric,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent uuid;
  v_vente public.ventes;
  v_new numeric;
  v_statut text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = auth.uid();
  IF v_ent IS NULL THEN RAISE EXCEPTION 'Profil sans entreprise'; END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;

  SELECT * INTO v_vente FROM public.ventes WHERE id = p_vente_id AND entreprise_id = v_ent FOR UPDATE;
  IF v_vente.id IS NULL THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
  IF v_vente.statut_annulation = 'annulee' THEN RAISE EXCEPTION 'Impossible d''encaisser une vente annulée'; END IF;
  IF v_vente.statut_encaissement = 'encaisse' THEN
    RAISE EXCEPTION 'Cette vente est déjà totalement encaissée';
  END IF;

  v_new := LEAST(v_vente.montant_total_fcfa, COALESCE(v_vente.montant_encaisse_fcfa, 0) + p_montant);
  v_statut := CASE WHEN v_new >= v_vente.montant_total_fcfa THEN 'encaisse' ELSE 'partiel' END;

  UPDATE public.ventes
     SET montant_encaisse_fcfa = v_new,
         statut_encaissement = v_statut,
         date_encaissement = COALESCE(p_date, CURRENT_DATE)
   WHERE id = p_vente_id;

  RETURN jsonb_build_object(
    'ok', true, 'statut', v_statut,
    'montant_encaisse', v_new, 'reste', GREATEST(v_vente.montant_total_fcfa - v_new, 0)
  );
END;
$$;