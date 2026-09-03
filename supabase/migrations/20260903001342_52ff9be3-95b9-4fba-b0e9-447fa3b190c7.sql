-- Sécuriser les nouvelles fonctions RPC : interdire l'appel anonyme
REVOKE EXECUTE ON FUNCTION public.annuler_vente(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.payer_royalties_auteur(uuid[], text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enregistrer_encaissement(uuid, numeric, date) FROM PUBLIC, anon;

-- S'assurer que authenticated peut toujours appeler ces fonctions
GRANT EXECUTE ON FUNCTION public.annuler_vente(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payer_royalties_auteur(uuid[], text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_encaissement(uuid, numeric, date) TO authenticated;