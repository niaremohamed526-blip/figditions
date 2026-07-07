
-- Table des codes promo (gérée côté serveur uniquement)
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('pro','business')),
  periode TEXT NOT NULL DEFAULT 'a_vie' CHECK (periode IN ('mensuel','annuel','a_vie')),
  duree_jours INTEGER,
  max_utilisations INTEGER NOT NULL DEFAULT 1,
  utilisations_actuelles INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  actif BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.promo_codes TO service_role;
-- No grants to authenticated/anon: only readable through SECURITY DEFINER RPC.

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
-- No policies = no direct client access.

-- Table de traçabilité des utilisations
CREATE TABLE public.promo_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  plan_applique TEXT NOT NULL,
  periode_appliquee TEXT NOT NULL,
  expire_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, entreprise_id)
);

GRANT SELECT ON public.promo_code_redemptions TO authenticated;
GRANT ALL ON public.promo_code_redemptions TO service_role;

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their entreprise redemptions"
ON public.promo_code_redemptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.entreprise_id = promo_code_redemptions.entreprise_id
      AND p.role = 'admin'
  )
);

-- RPC de rédemption
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT, p_entreprise_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_user_ent UUID;
  v_promo RECORD;
  v_expire TIMESTAMPTZ;
  v_max_users INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous devez être connecté');
  END IF;

  SELECT role, entreprise_id INTO v_role, v_user_ent
  FROM public.profiles WHERE id = v_user_id;

  IF v_role IS DISTINCT FROM 'admin' OR v_user_ent IS DISTINCT FROM p_entreprise_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un admin de l''entreprise peut utiliser un code');
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = upper(trim(p_code))
    AND actif = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code invalide ou expiré');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce code a expiré');
  END IF;

  IF v_promo.utilisations_actuelles >= v_promo.max_utilisations THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce code a déjà été utilisé le nombre maximum de fois');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.promo_code_redemptions
    WHERE promo_code_id = v_promo.id AND entreprise_id = p_entreprise_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Votre entreprise a déjà utilisé ce code');
  END IF;

  -- Calcule la date d'expiration
  IF v_promo.periode = 'a_vie' THEN
    v_expire := NULL;
  ELSIF v_promo.duree_jours IS NOT NULL THEN
    v_expire := now() + make_interval(days => v_promo.duree_jours);
  ELSIF v_promo.periode = 'annuel' THEN
    v_expire := now() + interval '1 year';
  ELSE
    v_expire := now() + interval '1 month';
  END IF;

  v_max_users := CASE v_promo.plan WHEN 'business' THEN 999 WHEN 'pro' THEN 3 ELSE 1 END;

  -- Applique le plan
  UPDATE public.entreprises
  SET plan = v_promo.plan,
      max_utilisateurs = v_max_users,
      abonnement_expire_le = v_expire
  WHERE id = p_entreprise_id;

  -- Enregistre l'utilisation
  INSERT INTO public.promo_code_redemptions (
    promo_code_id, entreprise_id, user_id, plan_applique, periode_appliquee, expire_le
  ) VALUES (
    v_promo.id, p_entreprise_id, v_user_id, v_promo.plan, v_promo.periode, v_expire
  );

  UPDATE public.promo_codes
  SET utilisations_actuelles = utilisations_actuelles + 1,
      updated_at = now()
  WHERE id = v_promo.id;

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_promo.plan,
    'periode', v_promo.periode,
    'expire_le', v_expire,
    'message', 'Plan ' || initcap(v_promo.plan) || ' activé'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, UUID) TO authenticated;

-- Trigger updated_at
CREATE TRIGGER trg_promo_codes_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Code de démonstration
INSERT INTO public.promo_codes (code, plan, periode, max_utilisations, description)
VALUES ('FIGBUSINESS2026', 'business', 'a_vie', 100, 'Code de lancement Business à vie');
