
REVOKE EXECUTE ON FUNCTION public.fn_notify(uuid,text,text,text,text,jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_manuscrit_publie() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_manuscrit_inserted() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_vente_inserted() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_vente_paye() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_stock_interne_bas() FROM public, anon, authenticated;
