-- =========================================================
-- 1) Scope tenant-table policies to `authenticated` role
-- =========================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('manuscrits','estimations_cout','conversions','stock_interne',
                        'pdf_partages','mouvements_stock','stocks','auteurs','ventes',
                        'contrats','entreprises')
      AND 'public' = ANY(roles::text[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Recreate tenant policies scoped to authenticated
CREATE POLICY "ent select auteurs" ON public.auteurs FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert auteurs" ON public.auteurs FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update auteurs" ON public.auteurs FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete auteurs" ON public.auteurs FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select contrats" ON public.contrats FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert contrats" ON public.contrats FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update contrats" ON public.contrats FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete contrats" ON public.contrats FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select conversions" ON public.conversions FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert conversions" ON public.conversions FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update conversions" ON public.conversions FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete conversions" ON public.conversions FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select estimations" ON public.estimations_cout FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert estimations" ON public.estimations_cout FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update estimations" ON public.estimations_cout FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete estimations" ON public.estimations_cout FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select manuscrits" ON public.manuscrits FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert manuscrits" ON public.manuscrits FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update manuscrits" ON public.manuscrits FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete manuscrits" ON public.manuscrits FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select mouvements_stock" ON public.mouvements_stock FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert mouvements_stock" ON public.mouvements_stock FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update mouvements_stock" ON public.mouvements_stock FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete mouvements_stock" ON public.mouvements_stock FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select pdf_partages" ON public.pdf_partages FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert pdf_partages" ON public.pdf_partages FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update pdf_partages" ON public.pdf_partages FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete pdf_partages" ON public.pdf_partages FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select stock_interne" ON public.stock_interne FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert stock_interne" ON public.stock_interne FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update stock_interne" ON public.stock_interne FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete stock_interne" ON public.stock_interne FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select stocks" ON public.stocks FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert stocks" ON public.stocks FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update stocks" ON public.stocks FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete stocks" ON public.stocks FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "ent select ventes" ON public.ventes FOR SELECT TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent insert ventes" ON public.ventes FOR INSERT TO authenticated WITH CHECK (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent update ventes" ON public.ventes FOR UPDATE TO authenticated USING (entreprise_id = private.current_entreprise_id());
CREATE POLICY "ent delete ventes" ON public.ventes FOR DELETE TO authenticated USING (entreprise_id = private.current_entreprise_id());

CREATE POLICY "owner select entreprises" ON public.entreprises FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner insert entreprises" ON public.entreprises FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update entreprises" ON public.entreprises FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner delete entreprises" ON public.entreprises FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- =========================================================
-- 2) Lock down SECURITY DEFINER function execution
-- =========================================================
-- Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions in public schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant EXECUTE only on client-callable RPCs to appropriate roles
GRANT EXECUTE ON FUNCTION public.get_invitation_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_pdf_view(uuid)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bordereau(text, text, text, date, date, jsonb, integer, numeric, text) TO authenticated;

-- =========================================================
-- 3) Explicit lock policy for private database export bucket
-- =========================================================
DROP POLICY IF EXISTS "database_export_locked" ON storage.objects;
CREATE POLICY "database_export_locked"
ON storage.objects
FOR ALL
TO anon, authenticated
USING (bucket_id = 'database_export_04_07_26' AND false)
WITH CHECK (bucket_id = 'database_export_04_07_26' AND false);
