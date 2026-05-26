CREATE POLICY "members select entreprises"
ON public.entreprises
FOR SELECT
TO authenticated
USING (id = public.current_entreprise_id());