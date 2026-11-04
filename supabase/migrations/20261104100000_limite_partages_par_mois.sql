-- Limite mensuelle des liens de lecture sécurisés, appliquée aussi par la base.
-- Avant : seul l'écran de l'application comptait les liens du mois, donc un appel
-- direct pouvait dépasser la limite. Mêmes valeurs que src/lib/plans.ts
-- (partagesParMois) : Starter 0, Pro 10, Business illimité. Mois en heure GMT.
-- Annulation : DROP TRIGGER enforce_plan_partages ON public.pdf_partages;
--              DROP FUNCTION public.enforce_plan_partages();
CREATE OR REPLACE FUNCTION public.enforce_plan_partages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan  text;
  v_max   int;
  v_count int;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;

  SELECT COALESCE(plan::text, 'starter') INTO v_plan FROM public.entreprises WHERE id = NEW.entreprise_id;
  v_max := CASE COALESCE(v_plan, 'starter') WHEN 'business' THEN NULL WHEN 'pro' THEN 10 ELSE 0 END;
  IF v_max IS NULL THEN RETURN NEW; END IF;

  IF v_max = 0 THEN
    RAISE EXCEPTION 'Le partage sécurisé nécessite le plan Pro ou Business.';
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.pdf_partages
   WHERE entreprise_id = NEW.entreprise_id
     AND created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Vous avez créé vos % liens sécurisés de ce mois. Passez au plan Business pour un partage illimité.', v_max;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_plan_partages ON public.pdf_partages;
CREATE TRIGGER enforce_plan_partages
  BEFORE INSERT ON public.pdf_partages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_partages();
