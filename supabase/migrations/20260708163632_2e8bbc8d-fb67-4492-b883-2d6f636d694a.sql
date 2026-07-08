
CREATE OR REPLACE FUNCTION public._debug_profile(p_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = p_id;
$$;
GRANT EXECUTE ON FUNCTION public._debug_profile(uuid) TO authenticated, anon, service_role;
