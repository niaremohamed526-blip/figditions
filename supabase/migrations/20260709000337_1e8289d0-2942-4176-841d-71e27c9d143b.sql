-- 1) Add columns
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS commission_librairie_fcfa numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canal_vente text NOT NULL DEFAULT 'externe';

-- Constrain canal_vente values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ventes_canal_vente_check'
  ) THEN
    ALTER TABLE public.ventes
      ADD CONSTRAINT ventes_canal_vente_check
      CHECK (canal_vente IN ('externe','interne'));
  END IF;
END$$;

-- 2) Update the external stock -> ventes trigger to compute 20 % librairie commission
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
BEGIN
  v_delta := COALESCE(NEW.exemplaires_vendus, 0) - COALESCE(OLD.exemplaires_vendus, 0);
  IF v_delta > 0 AND COALESCE(NEW.prix_unitaire_fcfa, 0) > 0 THEN
    SELECT auteur_id INTO v_auteur FROM public.manuscrits WHERE id = NEW.manuscrit_id;
    v_montant := v_delta * NEW.prix_unitaire_fcfa;
    v_commission := round(v_montant * 0.20);
    v_pct := public.pourcentage_droits_pour(NEW.manuscrit_id, v_auteur);
    INSERT INTO public.ventes(
      entreprise_id, manuscrit_id, auteur_id,
      quantite_vendue, prix_unitaire_fcfa, montant_total_fcfa, montant,
      droits_auteur_fcfa, commission_librairie_fcfa, canal_vente,
      statut_paiement, date_vente
    ) VALUES (
      NEW.entreprise_id, NEW.manuscrit_id, v_auteur,
      v_delta, NEW.prix_unitaire_fcfa, v_montant, v_montant,
      round(v_montant * v_pct / 100), v_commission, 'externe',
      'en_attente', CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END$function$;

-- 3) Update the mouvement (internal) cascade to mark canal='interne' (commission stays 0)
CREATE OR REPLACE FUNCTION public.trg_mouvement_cascade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        droits_auteur_fcfa, commission_librairie_fcfa, canal_vente,
        statut_paiement, date_vente
      ) VALUES (
        NEW.entreprise_id, NEW.manuscrit_id, v_auteur,
        NEW.quantite, v_prix, v_montant, v_montant,
        round(v_montant * v_pct / 100), 0, 'interne',
        'en_attente', NEW.date_mouvement
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
END$function$;