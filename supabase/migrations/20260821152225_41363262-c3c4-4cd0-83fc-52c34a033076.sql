CREATE OR REPLACE FUNCTION public.trg_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_url text;
  v_secret  text;
BEGIN
  SELECT value INTO v_app_url FROM public.app_config WHERE key = 'public_url';
  SELECT value INTO v_secret  FROM public.app_config WHERE key = 'cron_secret';
  IF v_app_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_app_url || '/api/public/hooks/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_secret
    ),
    body    := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_notification_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_notification_push ON public.notifications;
CREATE TRIGGER on_notification_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_notification_push();