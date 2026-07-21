
ALTER TABLE public.stocks
  ADD COLUMN IF NOT EXISTS taux_commission_pct numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS applique_droits_auteur boolean NOT NULL DEFAULT true;

ALTER TABLE public.stocks
  DROP CONSTRAINT IF EXISTS stocks_taux_commission_pct_check;
ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_taux_commission_pct_check
  CHECK (taux_commission_pct IN (0, 10, 15, 20));

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
      statut_paiement, date_vente
    ) VALUES (
      NEW.entreprise_id, NEW.manuscrit_id, v_auteur,
      v_delta, NEW.prix_unitaire_fcfa, v_montant, v_montant,
      v_droits, v_commission, 'externe',
      'en_attente', CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END$function$;
