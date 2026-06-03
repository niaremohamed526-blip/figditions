
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_entreprise_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.current_entreprise_plan()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.plan::text
  FROM public.entreprises e
  JOIN public.profiles p ON p.entreprise_id = e.id
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.current_entreprise_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_entreprise_plan() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_entreprise_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_entreprise_plan() TO authenticated, service_role;

-- Update plan-enforcement triggers to point at the private function
CREATE OR REPLACE FUNCTION public.enforce_plan_contrats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF COALESCE(private.current_entreprise_plan(), 'starter') NOT IN ('pro', 'business') THEN
    RAISE EXCEPTION 'Les contrats nécessitent le plan Pro ou Business';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_plan_ventes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF COALESCE(private.current_entreprise_plan(), 'starter') NOT IN ('pro', 'business') THEN
    RAISE EXCEPTION 'Le module Finances nécessite le plan Pro ou Business';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_plan_manuscrits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text; v_count int;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  v_plan := COALESCE(private.current_entreprise_plan(), 'starter');
  IF v_plan = 'starter' THEN
    SELECT COUNT(*) INTO v_count FROM public.manuscrits WHERE entreprise_id = NEW.entreprise_id;
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Le plan Starter est limité à 5 manuscrits. Passez au plan Pro pour ajouter davantage de manuscrits.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.enforce_plan_contrats() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_ventes() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_plan_manuscrits() FROM public, anon, authenticated;

-- Repoint all policies to the private helpers
ALTER POLICY "ent select manuscrits" ON public.manuscrits USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert manuscrits" ON public.manuscrits WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update manuscrits" ON public.manuscrits USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete manuscrits" ON public.manuscrits USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select stocks" ON public.stocks USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert stocks" ON public.stocks WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update stocks" ON public.stocks USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete stocks" ON public.stocks USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select ventes" ON public.ventes USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert ventes" ON public.ventes WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update ventes" ON public.ventes USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete ventes" ON public.ventes USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select auteurs" ON public.auteurs USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert auteurs" ON public.auteurs WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update auteurs" ON public.auteurs USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete auteurs" ON public.auteurs USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select estimations" ON public.estimations_cout USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert estimations" ON public.estimations_cout WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update estimations" ON public.estimations_cout USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete estimations" ON public.estimations_cout USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select contrats" ON public.contrats USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert contrats" ON public.contrats WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update contrats" ON public.contrats USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete contrats" ON public.contrats USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select pdf_partages" ON public.pdf_partages USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert pdf_partages" ON public.pdf_partages WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update pdf_partages" ON public.pdf_partages USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete pdf_partages" ON public.pdf_partages USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete mouvements_stock" ON public.mouvements_stock USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select stock_interne" ON public.stock_interne USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert stock_interne" ON public.stock_interne WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update stock_interne" ON public.stock_interne USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete stock_interne" ON public.stock_interne USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select mouvements_stock" ON public.mouvements_stock USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert mouvements_stock" ON public.mouvements_stock WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update mouvements_stock" ON public.mouvements_stock USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select abonnements" ON public.abonnements USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent select paiements" ON public.paiements USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "members select entreprises" ON public.entreprises USING ((id = private.current_entreprise_id()));
ALTER POLICY "ent select notifications" ON public.notifications USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update notifications" ON public.notifications USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "admin insert invitations" ON public.invitations WITH CHECK (((entreprise_id = private.current_entreprise_id()) AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))));
ALTER POLICY "members select entreprise" ON public.profiles USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "admin update invitations" ON public.invitations USING (((entreprise_id = private.current_entreprise_id()) AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))));
ALTER POLICY "admin delete invitations" ON public.invitations USING (((entreprise_id = private.current_entreprise_id()) AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))));
ALTER POLICY "ent select conversions" ON public.conversions USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent insert conversions" ON public.conversions WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent update conversions" ON public.conversions USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "ent delete conversions" ON public.conversions USING ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "admin select invitations" ON public.invitations USING (((entreprise_id = private.current_entreprise_id()) AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))));
ALTER POLICY "admin update members" ON public.profiles USING (((entreprise_id = private.current_entreprise_id()) AND (id <> auth.uid()) AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))) WITH CHECK ((entreprise_id = private.current_entreprise_id()));
ALTER POLICY "admin delete members" ON public.profiles USING (((entreprise_id = private.current_entreprise_id()) AND (id <> auth.uid()) AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))));
ALTER POLICY "logos auth upload" ON storage.objects WITH CHECK (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "logos auth update" ON storage.objects USING (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "logos auth delete" ON storage.objects USING (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "ent read manuscrits files" ON storage.objects USING (((bucket_id = 'manuscrits'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "ent upload manuscrits files" ON storage.objects WITH CHECK (((bucket_id = 'manuscrits'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "ent update manuscrits files" ON storage.objects USING (((bucket_id = 'manuscrits'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "ent delete manuscrits files" ON storage.objects USING (((bucket_id = 'manuscrits'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "logos auth insert own ent" ON storage.objects WITH CHECK (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "logos auth update own ent" ON storage.objects USING (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "logos auth delete own ent" ON storage.objects USING (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "tenant scoped realtime read" ON realtime.messages USING (((realtime.topic() ~~ (('rt:%:'::text || (private.current_entreprise_id())::text) || ':%'::text)) OR (realtime.topic() = ('notifications:'::text || (private.current_entreprise_id())::text))));
ALTER POLICY "tenant scoped realtime write" ON realtime.messages WITH CHECK (((realtime.topic() ~~ (('rt:%:'::text || (private.current_entreprise_id())::text) || ':%'::text)) OR (realtime.topic() = ('notifications:'::text || (private.current_entreprise_id())::text))));
ALTER POLICY "ent read conversion files" ON storage.objects USING (((bucket_id = 'conversions'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "ent insert conversion files" ON storage.objects WITH CHECK (((bucket_id = 'conversions'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "ent update conversion files" ON storage.objects USING (((bucket_id = 'conversions'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));
ALTER POLICY "ent delete conversion files" ON storage.objects USING (((bucket_id = 'conversions'::text) AND ((storage.foldername(name))[1] = (private.current_entreprise_id())::text)));

-- Drop the now-unused public helpers
DROP FUNCTION IF EXISTS public.current_entreprise_id();
DROP FUNCTION IF EXISTS public.current_entreprise_plan();
