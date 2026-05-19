
REVOKE EXECUTE ON FUNCTION public.current_entreprise_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_entreprise_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
