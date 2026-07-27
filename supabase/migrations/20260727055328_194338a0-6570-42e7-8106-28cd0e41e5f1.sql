-- Enable pg_net for outbound HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table for browser push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise_id UUID REFERENCES public.entreprises(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push subs select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own push subs insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own push subs update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own push subs delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER push_subs_touch BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger: on new notification, call the send-push endpoint via pg_net
CREATE OR REPLACE FUNCTION public.trg_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_app_url text;
  v_cron text;
BEGIN
  v_app_url := current_setting('app.public_url', true);
  v_cron := current_setting('app.cron_secret', true);
  IF v_app_url IS NULL OR v_app_url = '' OR v_cron IS NULL OR v_cron = '' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := v_app_url || '/api/public/hooks/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_cron
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block notification insert on push failure
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_push ON public.notifications;
CREATE TRIGGER trg_notification_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_notification_push();