REVOKE EXECUTE ON FUNCTION public.add_depot_batch(uuid, text, integer, numeric, text, date, text, numeric, boolean, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_depot_batch(uuid, text, integer, numeric, text, date, text, numeric, boolean, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_stock_mouvement(uuid, text, integer, text, text, date, uuid, text, numeric, integer, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_stock_mouvement(uuid, text, integer, text, text, date, uuid, text, numeric, integer, numeric, text) TO authenticated, service_role;