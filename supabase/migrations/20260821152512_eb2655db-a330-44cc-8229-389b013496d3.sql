CREATE OR REPLACE FUNCTION public.push_dispatch_data(p_notification_id uuid, p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif RECORD;
  v_subs  jsonb;
BEGIN
  IF p_secret IS NULL
     OR p_secret <> (SELECT value FROM public.app_config WHERE key = 'cron_secret') THEN
    RETURN NULL;
  END IF;

  SELECT id, entreprise_id, titre, message, lien INTO v_notif
  FROM public.notifications WHERE id = p_notification_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth
  )), '[]'::jsonb)
    INTO v_subs
  FROM public.push_subscriptions s
  WHERE s.entreprise_id = v_notif.entreprise_id;

  RETURN jsonb_build_object(
    'id', v_notif.id,
    'titre', v_notif.titre,
    'message', v_notif.message,
    'lien', v_notif.lien,
    'subscriptions', v_subs
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.push_dispatch_data(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.push_dispatch_data(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.push_dispatch_cleanup(p_secret text, p_endpoints text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_secret IS NULL
     OR p_secret <> (SELECT value FROM public.app_config WHERE key = 'cron_secret') THEN
    RETURN;
  END IF;
  DELETE FROM public.push_subscriptions WHERE endpoint = ANY(p_endpoints);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.push_dispatch_cleanup(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.push_dispatch_cleanup(text, text[]) TO anon, authenticated, service_role;