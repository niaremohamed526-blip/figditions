ALTER TABLE public.manuscrits
  ADD COLUMN IF NOT EXISTS statut_distribution text NOT NULL DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS prix_vente_fcfa numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.manuscrits
  DROP CONSTRAINT IF EXISTS manuscrits_statut_distribution_check;
ALTER TABLE public.manuscrits
  ADD CONSTRAINT manuscrits_statut_distribution_check
  CHECK (statut_distribution IN ('disponible', 'rupture', 'retire'));

CREATE OR REPLACE FUNCTION public.zz_ventes_etranger_no_droits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS zz_ventes_etranger_no_droits ON public.ventes;
CREATE TRIGGER zz_ventes_etranger_no_droits
  BEFORE INSERT OR UPDATE ON public.ventes
  FOR EACH ROW EXECUTE FUNCTION public.zz_ventes_etranger_no_droits();

UPDATE public.ventes v
SET droits_auteur_fcfa = 0, auteur_id = NULL, statut_paiement = 'paye'::paiement_statut
FROM public.manuscrits m
WHERE m.id = v.manuscrit_id
  AND m.origine = 'etranger'
  AND (v.droits_auteur_fcfa <> 0 OR v.auteur_id IS NOT NULL);