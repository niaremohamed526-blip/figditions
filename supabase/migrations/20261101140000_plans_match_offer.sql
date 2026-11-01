-- Les règles de la base suivent l'offre approuvée (src/lib/plans.ts).
-- Sans danger à relancer.

-- 1) Starter promet le stock et les dépôts en librairie : il doit pouvoir
--    enregistrer ses ventes. Le module Finances (dépenses, paiements de
--    droits d'auteur) reste réservé à Pro et Business : ces règles-là restent.
DROP TRIGGER IF EXISTS trg_enforce_plan_ventes ON public.ventes;

-- 2) Les bordereaux sont inclus dans Pro (offre « Bordereaux de vente »),
--    pas seulement dans Business. L'abonnement doit toujours être actif.
CREATE OR REPLACE FUNCTION public.enforce_plan_bordereaux()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_plan text; v_exp timestamptz;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT plan, abonnement_expire_le INTO v_plan, v_exp
    FROM public.entreprises WHERE id = NEW.entreprise_id;
  IF COALESCE(v_plan, 'starter') NOT IN ('pro', 'business')
     OR (v_exp IS NOT NULL AND v_exp <= now()) THEN
    RAISE EXCEPTION 'Les bordereaux sont inclus à partir du plan Pro (abonnement actif)';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_plan_bordereaux() FROM PUBLIC, anon, authenticated;
