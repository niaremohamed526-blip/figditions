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
    NEW.statut_paiement := 'paye'::paiement_statut;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.zz_ventes_etranger_no_droits() FROM PUBLIC, anon, authenticated;