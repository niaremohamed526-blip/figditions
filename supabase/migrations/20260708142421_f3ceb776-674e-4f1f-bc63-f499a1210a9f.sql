
-- Extensions pour cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 1. get_invitation_public : lecture publique
-- ============================================
CREATE OR REPLACE FUNCTION public.get_invitation_public(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_ent_nom text;
BEGIN
  SELECT id, email, statut, expires_at, permissions, full_name, role_label, entreprise_id
    INTO v_inv
  FROM public.invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;
  IF v_inv.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'used');
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  SELECT nom INTO v_ent_nom FROM public.entreprises WHERE id = v_inv.entreprise_id;

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_inv.email,
    'full_name', v_inv.full_name,
    'role_label', v_inv.role_label,
    'permissions', COALESCE(v_inv.permissions, '{}'::jsonb),
    'entreprise_nom', COALESCE(v_ent_nom, 'votre maison d''édition')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_public(uuid) TO anon, authenticated;

-- ============================================
-- 2. accept_invitation : acceptation sécurisée
-- ============================================
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv RECORD;
  v_valid_keys text[] := ARRAY[
    'dashboard','manuscrits','auteurs','stocks_interne','stocks_externe',
    'finances','contrats','conversions','estimateur','imprimeries'
  ];
  v_perms jsonb := '{"dashboard":true}'::jsonb;
  v_k text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifié');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation introuvable');
  END IF;
  IF v_inv.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation déjà utilisée');
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation expirée');
  END IF;
  IF lower(v_email) <> lower(v_inv.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ce lien n''est pas valide pour votre adresse email');
  END IF;

  -- Sanitize permissions
  FOREACH v_k IN ARRAY v_valid_keys LOOP
    IF (v_inv.permissions ? v_k) AND (v_inv.permissions ->> v_k)::boolean = true THEN
      v_perms := v_perms || jsonb_build_object(v_k, true);
    END IF;
  END LOOP;
  v_perms := v_perms || jsonb_build_object('parametres', false);

  -- Nettoie les entreprises fantômes créées par handle_new_user
  DELETE FROM public.entreprises
  WHERE owner_id = v_uid AND id <> v_inv.entreprise_id;

  -- Rattache le profil
  UPDATE public.profiles
  SET entreprise_id = v_inv.entreprise_id,
      role = 'membre',
      permissions = v_perms,
      role_label = v_inv.role_label,
      full_name = COALESCE(v_inv.full_name, full_name)
  WHERE id = v_uid;

  UPDATE public.invitations SET statut = 'acceptee' WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'entreprise_id', v_inv.entreprise_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- ============================================
-- 3. Cron quotidien : check-reminders à 8h UTC
-- ============================================
-- Désinstalle un ancien job s'il existe
DO $$
BEGIN
  PERFORM cron.unschedule('check-reminders-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-reminders-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://figditions.vercel.app/api/public/hooks/check-reminders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdWZ4Y2ZsbGJ5b2FkaGVkeXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDQ5NDIsImV4cCI6MjA5NDc4MDk0Mn0.wCbgvlSpLN3LJFD9ysTq-Sz-zFfWFue4Sedwdp_GN4s"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
