-- Limites de débit (anti-abus) : Pr. MEDMO et import de contrat.
-- Chaque appel coûteux passe par public.consommer_limite, qui compte les appels
-- récents de l'utilisateur et refuse au-delà du plafond. Les plafonds sont fixés
-- ici, côté serveur, pour qu'un client ne puisse pas les choisir.

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_events_user_action_time
  ON public.rate_limit_events (user_id, action, created_at DESC);

-- Personne ne lit ni n'écrit la table directement : seule la fonction y touche.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consommer_limite(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_max_minute int;
  v_max_jour int;
  v_minute int;
  v_jour int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'non_authentifie');
  END IF;

  -- Plafonds par personne, bien au-dessus d'un usage normal.
  IF p_action = 'medmo' THEN
    v_max_minute := 10; v_max_jour := 200;
  ELSIF p_action = 'contrat_import' THEN
    v_max_minute := 3; v_max_jour := 30;
  ELSE
    RETURN jsonb_build_object('ok', false, 'raison', 'action_inconnue');
  END IF;

  -- Un verrou par personne et par action : deux appels simultanés ne passent pas tous les deux.
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_action));

  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute'),
         count(*)
    INTO v_minute, v_jour
    FROM public.rate_limit_events
   WHERE user_id = v_uid AND action = p_action
     AND created_at > now() - interval '1 day';

  IF v_minute >= v_max_minute THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'minute');
  END IF;
  IF v_jour >= v_max_jour THEN
    RETURN jsonb_build_object('ok', false, 'raison', 'jour');
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action) VALUES (v_uid, p_action);

  -- Ménage : on ne garde que les dernières 48 heures de cette personne.
  DELETE FROM public.rate_limit_events
   WHERE user_id = v_uid AND created_at < now() - interval '2 days';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consommer_limite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consommer_limite(text) TO authenticated;

-- Taille maximale des fichiers déposés (au-dessus des limites affichées dans l'app).
UPDATE storage.buckets SET file_size_limit = 26214400 WHERE id = 'manuscrits';   -- 25 Mo (l'app accepte 10 Mo)
UPDATE storage.buckets SET file_size_limit = 10485760 WHERE id = 'logos';        -- 10 Mo
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'conversions';  -- 50 Mo (l'app accepte 50 Mo)

-- Note de mise à jour v2.13.
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Plus de protection contre les abus',
  'FIGDITIONS limite maintenant les demandes trop rapides, pour que le service reste disponible pour tous.',
  '2.13',
  '[
    {"type": "amelioration", "page_concernee": "medmo", "texte": "Pr. MEDMO est protégé contre les envois en rafale : au-delà de 10 questions par minute, il demande de patienter un instant."},
    {"type": "amelioration", "page_concernee": "contrats", "texte": "L''import de contrat par Pr. MEDMO est limité à 30 fichiers par jour et par personne."},
    {"type": "amelioration", "page_concernee": "global", "texte": "Taille maximale des fichiers déposés contrôlée sur nos serveurs, en plus de la vérification dans l''app."}
  ]'::jsonb
);
