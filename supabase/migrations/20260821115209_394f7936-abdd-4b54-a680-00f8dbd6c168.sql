REVOKE EXECUTE ON FUNCTION public.record_stock_mouvement(uuid, text, integer, text, text, date, uuid, text, numeric, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_stock_mouvement(uuid, text, integer, text, text, date, uuid, text, numeric, integer, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_stock_mouvement(uuid, text, integer, text, text, date, uuid, text, numeric, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_mouvement(uuid, text, integer, text, text, date, uuid, text, numeric, integer, numeric) TO service_role;