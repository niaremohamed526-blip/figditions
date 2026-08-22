-- 1) Encaissement traçable sur chaque vente
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS statut_encaissement text NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS montant_encaisse_fcfa numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_encaissement date,
  ADD COLUMN IF NOT EXISTS librairie_nom text,
  ADD COLUMN IF NOT EXISTS stock_id uuid REFERENCES public.stocks(id) ON DELETE SET NULL;

UPDATE public.ventes
   SET statut_encaissement = 'encaisse',
       montant_encaisse_fcfa = montant_total_fcfa,
       date_encaissement = date_vente
 WHERE canal_vente = 'interne'
   AND statut_encaissement = 'en_attente';

-- 2) Dépenses
CREATE TABLE public.depenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  categorie text NOT NULL DEFAULT 'autre',
  libelle text NOT NULL,
  montant_fcfa numeric NOT NULL,
  date_depense date NOT NULL DEFAULT CURRENT_DATE,
  manuscrit_id uuid REFERENCES public.manuscrits(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.depenses TO authenticated;
GRANT ALL ON public.depenses TO service_role;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres peuvent voir les depenses"
  ON public.depenses FOR SELECT TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Membres peuvent creer des depenses"
  ON public.depenses FOR INSERT TO authenticated
  WITH CHECK (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Membres peuvent modifier les depenses"
  ON public.depenses FOR UPDATE TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Membres peuvent supprimer les depenses"
  ON public.depenses FOR DELETE TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE TRIGGER trg_depenses_plan BEFORE INSERT ON public.depenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_ventes();
CREATE TRIGGER trg_depenses_touch BEFORE UPDATE ON public.depenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Paiements de royalties (quittances)
CREATE TABLE public.paiements_royalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  numero text NOT NULL,
  annee integer NOT NULL,
  auteur_id uuid,
  auteur_nom text NOT NULL,
  vente_ids uuid[] NOT NULL,
  montant_fcfa numeric NOT NULL,
  methode text NOT NULL DEFAULT 'especes',
  reference text,
  notes text,
  paye_par uuid,
  paye_par_nom text,
  paye_le timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.paiements_royalties TO authenticated;
GRANT ALL ON public.paiements_royalties TO service_role;
ALTER TABLE public.paiements_royalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres peuvent voir les paiements de royalties"
  ON public.paiements_royalties FOR SELECT TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Membres peuvent creer des paiements de royalties"
  ON public.paiements_royalties FOR INSERT TO authenticated
  WITH CHECK (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE TRIGGER trg_paiements_royalties_plan BEFORE INSERT ON public.paiements_royalties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_ventes();

-- 4) Journal d'audit financier immuable
CREATE TABLE public.finance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  user_id uuid,
  user_nom text,
  action text NOT NULL,
  entite text NOT NULL,
  entite_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_audit_log TO authenticated;
GRANT ALL ON public.finance_audit_log TO service_role;
ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres peuvent consulter le journal financier"
  ON public.finance_audit_log FOR SELECT TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_finance_audit_ent ON public.finance_audit_log(entreprise_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_finance_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent uuid;
  v_eid uuid;
  v_nom text;
BEGIN
  v_ent := COALESCE(NEW.entreprise_id, OLD.entreprise_id);
  v_eid := COALESCE(NEW.id, OLD.id);
  SELECT full_name INTO v_nom FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.finance_audit_log(entreprise_id, user_id, user_nom, action, entite, entite_id, details)
  VALUES (
    v_ent, auth.uid(), COALESCE(v_nom, 'Système'),
    lower(TG_OP), TG_TABLE_NAME, v_eid,
    jsonb_build_object(
      'avant', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
      'apres', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
    )
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_ventes AFTER INSERT OR UPDATE OR DELETE ON public.ventes
  FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit();
CREATE TRIGGER trg_audit_depenses AFTER INSERT OR UPDATE OR DELETE ON public.depenses
  FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit();
CREATE TRIGGER trg_audit_paiements AFTER INSERT ON public.paiements_royalties
  FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit();

-- 5) RPC : paiement atomique des royalties d'un auteur
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
      AND (entreprise_id <> v_ent OR statut_paiement <> 'en_attente')
  ) THEN
    RAISE EXCEPTION 'Certaines ventes sont introuvables ou déjà payées';
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

-- 6) RPC : enregistrer un encaissement (total ou partiel)
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

-- 7) Les ventes librairie enregistrent la librairie d'origine
CREATE OR REPLACE FUNCTION public.trg_stocks_vente_delta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_delta int;
  v_auteur uuid;
  v_pct numeric;
  v_montant numeric;
  v_commission numeric;
  v_droits numeric;
BEGIN
  v_delta := COALESCE(NEW.exemplaires_vendus, 0) - COALESCE(OLD.exemplaires_vendus, 0);
  IF v_delta > 0 AND COALESCE(NEW.prix_unitaire_fcfa, 0) > 0 THEN
    SELECT auteur_id INTO v_auteur FROM public.manuscrits WHERE id = NEW.manuscrit_id;
    v_montant := v_delta * NEW.prix_unitaire_fcfa;
    v_commission := round(v_montant * COALESCE(NEW.taux_commission_pct, 20) / 100.0);
    IF COALESCE(NEW.applique_droits_auteur, true) THEN
      v_pct := public.pourcentage_droits_pour(NEW.manuscrit_id, v_auteur);
      v_droits := round(v_montant * v_pct / 100);
    ELSE
      v_droits := 0;
    END IF;
    INSERT INTO public.ventes(
      entreprise_id, manuscrit_id, auteur_id,
      quantite_vendue, prix_unitaire_fcfa, montant_total_fcfa, montant,
      droits_auteur_fcfa, commission_librairie_fcfa, canal_vente,
      statut_paiement, date_vente, librairie_nom, stock_id
    ) VALUES (
      NEW.entreprise_id, NEW.manuscrit_id, v_auteur,
      v_delta, NEW.prix_unitaire_fcfa, v_montant, v_montant,
      v_droits, v_commission, 'externe',
      'en_attente', CURRENT_DATE, NEW.librairie_nom, NEW.id
    );
  END IF;
  RETURN NEW;
END$function$;

-- 8) Les ventes directes via mouvements de stock sont encaissées immédiatement
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
    UPDATE public.stock_interne SET prix_vente_direct_fcfa = p_prix_catalogue WHERE id = v_stock.id;
    v_stock.prix_vente_direct_fcfa := p_prix_catalogue;
  ELSIF p_prix_unitaire IS NOT NULL AND p_prix_unitaire > 0 THEN
    UPDATE public.stock_interne SET prix_vente_direct_fcfa = p_prix_unitaire WHERE id = v_stock.id;
    v_stock.prix_vente_direct_fcfa := p_prix_unitaire;
  END IF;

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
        prix_catalogue_fcfa, remise_fcfa,
        statut_encaissement, montant_encaisse_fcfa, date_encaissement)
      VALUES (v_ent, p_manuscrit_id, v_auteur,
        p_quantite, v_prix_vente, v_montant, v_montant,
        round(v_montant * v_pct / 100), 0, 'interne', 'en_attente', p_date,
        CASE WHEN v_remise > 0 THEN v_prix ELSE NULL END, v_remise,
        'encaisse', v_montant, p_date);
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