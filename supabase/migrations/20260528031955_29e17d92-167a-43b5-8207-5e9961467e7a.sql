REVOKE EXECUTE ON FUNCTION public.guard_entreprises_sensitive_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_entreprises_sensitive_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_entreprises_sensitive_fields() FROM authenticated;