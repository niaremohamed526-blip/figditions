-- À exécuter seulement pour annuler la v2.17 (vitesse) : remet chaque règle de sécurité
-- exactement comme elle était avant, à partir de la copie faite par la migration.
-- Les index ajoutés ne changent aucun résultat ; ils peuvent rester.
DO $$
DECLARE
  s record;
  cmd text;
BEGIN
  FOR s IN
    SELECT b.tablename, b.policyname, b.qual, b.with_check
    FROM public._sauvegarde_politiques_v217 b
    JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = b.tablename AND p.policyname = b.policyname
    WHERE coalesce(p.qual, '') IS DISTINCT FROM coalesce(b.qual, '')
       OR coalesce(p.with_check, '') IS DISTINCT FROM coalesce(b.with_check, '')
  LOOP
    cmd := format('ALTER POLICY %I ON public.%I', s.policyname, s.tablename);
    IF s.qual IS NOT NULL THEN cmd := cmd || format(' USING (%s)', s.qual); END IF;
    IF s.with_check IS NOT NULL THEN cmd := cmd || format(' WITH CHECK (%s)', s.with_check); END IF;
    EXECUTE cmd;
  END LOOP;
END $$;
