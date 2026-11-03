-- L'annuaire des imprimeries est commun à toutes les maisons d'édition.
-- Avant : l'admin de n'importe quelle maison pouvait ajouter, modifier ou supprimer
-- une imprimerie vue par tout le monde. Maintenant : seul le propriétaire de la
-- plateforme (superadmin) le peut. Tout le monde peut toujours la consulter.
DROP POLICY IF EXISTS "admins insert imprimeries" ON public.imprimeries;
DROP POLICY IF EXISTS "admins update imprimeries" ON public.imprimeries;
DROP POLICY IF EXISTS "admins delete imprimeries" ON public.imprimeries;

CREATE POLICY "superadmin insert imprimeries" ON public.imprimeries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin((SELECT auth.uid())));
CREATE POLICY "superadmin update imprimeries" ON public.imprimeries
  FOR UPDATE TO authenticated
  USING (public.is_superadmin((SELECT auth.uid())))
  WITH CHECK (public.is_superadmin((SELECT auth.uid())));
CREATE POLICY "superadmin delete imprimeries" ON public.imprimeries
  FOR DELETE TO authenticated
  USING (public.is_superadmin((SELECT auth.uid())));
