CREATE OR REPLACE FUNCTION public.current_entreprise_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()
$function$;