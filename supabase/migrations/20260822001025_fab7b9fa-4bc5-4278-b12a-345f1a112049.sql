REVOKE EXECUTE ON FUNCTION public.fn_finance_audit() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payer_royalties_auteur(uuid[], text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.enregistrer_encaissement(uuid, numeric, date) FROM public, anon;