
CREATE OR REPLACE FUNCTION public.current_entreprise_plan()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.plan::text
  FROM public.entreprises e
  JOIN public.profiles p ON p.entreprise_id = e.id
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_entreprise_plan() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_entreprise_plan() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_plan_contrats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF COALESCE(public.current_entreprise_plan(), 'starter') NOT IN ('pro', 'business') THEN
    RAISE EXCEPTION 'Les contrats nécessitent le plan Pro ou Business';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_plan_contrats ON public.contrats;
CREATE TRIGGER trg_enforce_plan_contrats
  BEFORE INSERT ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_contrats();

CREATE OR REPLACE FUNCTION public.enforce_plan_ventes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF COALESCE(public.current_entreprise_plan(), 'starter') NOT IN ('pro', 'business') THEN
    RAISE EXCEPTION 'Le module Finances nécessite le plan Pro ou Business';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_plan_ventes ON public.ventes;
CREATE TRIGGER trg_enforce_plan_ventes
  BEFORE INSERT ON public.ventes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_ventes();

CREATE OR REPLACE FUNCTION public.enforce_plan_manuscrits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text; v_count int;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  v_plan := COALESCE(public.current_entreprise_plan(), 'starter');
  IF v_plan = 'starter' THEN
    SELECT COUNT(*) INTO v_count FROM public.manuscrits WHERE entreprise_id = NEW.entreprise_id;
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Le plan Starter est limité à 5 manuscrits. Passez au plan Pro pour ajouter davantage de manuscrits.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_plan_manuscrits ON public.manuscrits;
CREATE TRIGGER trg_enforce_plan_manuscrits
  BEFORE INSERT ON public.manuscrits
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_manuscrits();
