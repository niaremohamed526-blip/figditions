CREATE POLICY "admins update entreprises"
ON public.entreprises
FOR UPDATE
TO authenticated
USING (
  id = private.current_entreprise_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.entreprise_id = entreprises.id
      AND p.role = 'admin'
  )
)
WITH CHECK (
  id = private.current_entreprise_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.entreprise_id = entreprises.id
      AND p.role = 'admin'
  )
);