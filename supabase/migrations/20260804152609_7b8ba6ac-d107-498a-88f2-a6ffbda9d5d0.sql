-- 1) Scope tenant policies to authenticated instead of the catch-all public role
DROP POLICY IF EXISTS "ent select abonnements" ON public.abonnements;
CREATE POLICY "ent select abonnements" ON public.abonnements
  FOR SELECT TO authenticated
  USING (entreprise_id = private.current_entreprise_id());

DROP POLICY IF EXISTS "ent select paiements" ON public.paiements;
CREATE POLICY "ent select paiements" ON public.paiements
  FOR SELECT TO authenticated
  USING (entreprise_id = private.current_entreprise_id());

DROP POLICY IF EXISTS "ent select notifications" ON public.notifications;
CREATE POLICY "ent select notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (entreprise_id = private.current_entreprise_id());

DROP POLICY IF EXISTS "ent update notifications" ON public.notifications;
CREATE POLICY "ent update notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (entreprise_id = private.current_entreprise_id())
  WITH CHECK (entreprise_id = private.current_entreprise_id());

-- 2) SECURITY DEFINER functions: remove anon EXECUTE where no public flow needs it
REVOKE EXECUTE ON FUNCTION public.admin_confirm_paiement(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_paiement(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_paiements(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_paiements_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_qr_payment_request(text, text, numeric, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_pending_qr_payment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM anon;

-- increment_pdf_view is only ever called with the service role from the
-- openSharedPdf server function; no client role needs EXECUTE.
REVOKE EXECUTE ON FUNCTION public.increment_pdf_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_pdf_view(uuid) TO service_role;

-- get_invitation_public stays anon-callable: the public /rejoindre/:token page
-- resolves invitations before the user has an account.