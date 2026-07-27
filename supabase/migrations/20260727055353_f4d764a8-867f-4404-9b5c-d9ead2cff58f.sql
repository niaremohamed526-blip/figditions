-- Config table for trigger (service_role only)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role & SECURITY DEFINER functions read/write

-- Seed values (idempotent). URL is the stable published lovable URL.
INSERT INTO public.app_config(key, value) VALUES
  ('public_url', 'https://project--1d465579-2959-44ce-9ae1-cef3f8cf4dae.lovable.app')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Rewrite trigger to read from app_config, and pull CRON_SECRET via vault if available.
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
  SELECT value INTO v_app_url FROM public.app_config WHERE key = 'public_url';
  SELECT value INTO v_cron    FROM public.app_config WHERE key = 'cron_secret';
  IF v_app_url IS NULL OR v_cron IS NULL THEN
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
  RETURN NEW;
END;
$$;

-- Lock down execution
REVOKE ALL ON FUNCTION public.trg_notification_push() FROM PUBLIC, anon, authenticated;