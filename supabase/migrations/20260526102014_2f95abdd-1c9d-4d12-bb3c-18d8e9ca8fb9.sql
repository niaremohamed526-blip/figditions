
-- 1. Helper: royalty percentage for a (manuscrit, auteur) pair (latest signed contract, else 10%)
CREATE OR REPLACE FUNCTION public.pourcentage_droits_pour(p_manuscrit uuid, p_auteur uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pourcentage_droits
       FROM public.contrats
      WHERE manuscrit_id = p_manuscrit
        AND (p_auteur IS NULL OR auteur_id = p_auteur)
        AND statut = 'signe'
      ORDER BY date_signature DESC NULLS LAST, created_at DESC
      LIMIT 1),
    10
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pourcentage_droits_pour(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2. Trigger: mouvements_stock INSERT → cascade (vente_directe / transfert_librairie)
CREATE OR REPLACE FUNCTION public.trg_mouvement_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prix numeric := 0;
  v_auteur uuid;
  v_pct numeric;
  v_montant numeric;
BEGIN
  IF NEW.type_mouvement = 'vente_directe' THEN
    SELECT prix_vente_direct_fcfa INTO v_prix
      FROM public.stock_interne WHERE id = NEW.stock_interne_id;
    SELECT auteur_id INTO v_auteur FROM public.manuscrits WHERE id = NEW.manuscrit_id;
    IF COALESCE(v_prix, 0) > 0 THEN
      v_montant := NEW.quantite * v_prix;
      v_pct := public.pourcentage_droits_pour(NEW.manuscrit_id, v_auteur);
      INSERT INTO public.ventes(
        entreprise_id, manuscrit_id, auteur_id,
        quantite_vendue, prix_unitaire_fcfa, montant_total_fcfa, montant,
        droits_auteur_fcfa, statut_paiement, date_vente
      ) VALUES (
        NEW.entreprise_id, NEW.manuscrit_id, v_auteur,
        NEW.quantite, v_prix, v_montant, v_montant,
        v_montant * v_pct / 100, 'en_attente', NEW.date_mouvement
      );
    END IF;

  ELSIF NEW.type_mouvement = 'transfert_librairie' AND NEW.destination IS NOT NULL THEN
    SELECT prix_vente_direct_fcfa INTO v_prix
      FROM public.stock_interne WHERE id = NEW.stock_interne_id;
    INSERT INTO public.stocks(
      entreprise_id, manuscrit_id, librairie_nom,
      exemplaires_deposes, exemplaires_vendus, exemplaires_restants, exemplaires_total,
      prix_unitaire_fcfa
    ) VALUES (
      NEW.entreprise_id, NEW.manuscrit_id, NEW.destination,
      NEW.quantite, 0, NEW.quantite, NEW.quantite,
      COALESCE(v_prix, 0)
    );
  END IF;
  RETURN NEW;
END$$;
REVOKE EXECUTE ON FUNCTION public.trg_mouvement_cascade() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS mouvement_cascade ON public.mouvements_stock;
CREATE TRIGGER mouvement_cascade
AFTER INSERT ON public.mouvements_stock
FOR EACH ROW EXECUTE FUNCTION public.trg_mouvement_cascade();

-- 3. Trigger: stocks UPDATE → si exemplaires_vendus a augmenté → INSERT vente delta
CREATE OR REPLACE FUNCTION public.trg_stocks_vente_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta int;
  v_auteur uuid;
  v_pct numeric;
  v_montant numeric;
BEGIN
  v_delta := COALESCE(NEW.exemplaires_vendus, 0) - COALESCE(OLD.exemplaires_vendus, 0);
  IF v_delta > 0 AND COALESCE(NEW.prix_unitaire_fcfa, 0) > 0 THEN
    SELECT auteur_id INTO v_auteur FROM public.manuscrits WHERE id = NEW.manuscrit_id;
    v_montant := v_delta * NEW.prix_unitaire_fcfa;
    v_pct := public.pourcentage_droits_pour(NEW.manuscrit_id, v_auteur);
    INSERT INTO public.ventes(
      entreprise_id, manuscrit_id, auteur_id,
      quantite_vendue, prix_unitaire_fcfa, montant_total_fcfa, montant,
      droits_auteur_fcfa, statut_paiement, date_vente
    ) VALUES (
      NEW.entreprise_id, NEW.manuscrit_id, v_auteur,
      v_delta, NEW.prix_unitaire_fcfa, v_montant, v_montant,
      v_montant * v_pct / 100, 'en_attente', CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END$$;
REVOKE EXECUTE ON FUNCTION public.trg_stocks_vente_delta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stocks_vente_delta ON public.stocks;
CREATE TRIGGER stocks_vente_delta
AFTER UPDATE OF exemplaires_vendus ON public.stocks
FOR EACH ROW EXECUTE FUNCTION public.trg_stocks_vente_delta();

-- 4. Trigger: auteur DELETE → unlink (manuscrits.auteur_id NULL, ventes.auteur_id NULL)
CREATE OR REPLACE FUNCTION public.trg_auteur_delete_unlink()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.manuscrits SET auteur_id = NULL WHERE auteur_id = OLD.id;
  UPDATE public.ventes     SET auteur_id = NULL WHERE auteur_id = OLD.id;
  UPDATE public.contrats   SET auteur_id = NULL WHERE auteur_id = OLD.id;
  RETURN OLD;
END$$;
REVOKE EXECUTE ON FUNCTION public.trg_auteur_delete_unlink() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auteur_delete_unlink ON public.auteurs;
CREATE TRIGGER auteur_delete_unlink
BEFORE DELETE ON public.auteurs
FOR EACH ROW EXECUTE FUNCTION public.trg_auteur_delete_unlink();

-- 5. Trigger: manuscrit DELETE → notify (références orphelines)
CREATE OR REPLACE FUNCTION public.trg_manuscrit_delete_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrats int;
  v_stocks int;
  v_ventes int;
BEGIN
  SELECT COUNT(*) INTO v_contrats FROM public.contrats WHERE manuscrit_id = OLD.id;
  SELECT COUNT(*) INTO v_stocks   FROM public.stocks   WHERE manuscrit_id = OLD.id;
  SELECT COUNT(*) INTO v_ventes   FROM public.ventes   WHERE manuscrit_id = OLD.id;
  IF (v_contrats + v_stocks + v_ventes) > 0 THEN
    PERFORM public.fn_notify(
      OLD.entreprise_id, 'manuscrit_supprime',
      '🗑️ Manuscrit supprimé',
      'Le manuscrit « ' || OLD.titre || ' » a été supprimé. ' ||
      v_contrats || ' contrat(s), ' || v_stocks || ' stock(s), ' || v_ventes || ' vente(s) conservés en historique.',
      '/manuscrits',
      jsonb_build_object('manuscrit_id', OLD.id)
    );
  END IF;
  RETURN OLD;
END$$;
REVOKE EXECUTE ON FUNCTION public.trg_manuscrit_delete_notify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS manuscrit_delete_notify ON public.manuscrits;
CREATE TRIGGER manuscrit_delete_notify
BEFORE DELETE ON public.manuscrits
FOR EACH ROW EXECUTE FUNCTION public.trg_manuscrit_delete_notify();
