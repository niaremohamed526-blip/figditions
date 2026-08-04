-- 1) Effective plan takes expiry into account
CREATE OR REPLACE FUNCTION private.current_entreprise_plan()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN e.plan IN ('pro','business')
                AND e.abonnement_expire_le IS NOT NULL
                AND e.abonnement_expire_le <= now()
           THEN 'starter'
           ELSE e.plan::text
         END
  FROM public.entreprises e
  JOIN public.profiles p ON p.entreprise_id = e.id
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

-- 2) Bordereaux check must also respect expiry
CREATE OR REPLACE FUNCTION public.enforce_plan_bordereaux()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_plan text; v_exp timestamptz;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT plan, abonnement_expire_le INTO v_plan, v_exp
    FROM public.entreprises WHERE id = NEW.entreprise_id;
  IF COALESCE(v_plan,'starter') <> 'business'
     OR (v_exp IS NOT NULL AND v_exp <= now()) THEN
    RAISE EXCEPTION 'Les bordereaux sont réservés au plan Business (abonnement actif)';
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Daily downgrade job for expired subscriptions
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row RECORD; v_count int := 0;
BEGIN
  PERFORM set_config('app.allow_subscription_update', 'on', true);
  FOR v_row IN
    SELECT id, plan FROM public.entreprises
     WHERE plan IN ('pro','business')
       AND abonnement_expire_le IS NOT NULL
       AND abonnement_expire_le <= now()
  LOOP
    UPDATE public.entreprises
       SET plan = 'starter', max_utilisateurs = 1
     WHERE id = v_row.id;

    PERFORM public.fn_notify(
      v_row.id, 'plan_expire', '⏳ Abonnement expiré',
      'Votre abonnement ' || initcap(v_row.plan) || ' est arrivé à échéance. Votre compte est repassé au plan Starter — renouvelez pour réactiver vos fonctionnalités.',
      '/parametres', jsonb_build_object('ancien_plan', v_row.plan)
    );
    v_count := v_count + 1;
  END LOOP;
  PERFORM set_config('app.allow_subscription_update', 'off', true);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_subscriptions() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('expire-subscriptions-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-subscriptions-daily',
  '5 0 * * *',
  $$ SELECT public.expire_subscriptions(); $$
);