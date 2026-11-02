-- v2.16 : partage sécurisé renforcé.
-- expire_le : date au-delà de laquelle le lien ne s'ouvre plus (vide = sans limite).
-- code_exemplaire : code imprimé sur chaque page de l'exemplaire envoyé au lecteur,
--   pour retrouver qui a reçu une copie qui circule.
-- pays : pays approximatif de la connexion, quand l'hébergeur le fournit.
ALTER TABLE public.pdf_partages
  ADD COLUMN IF NOT EXISTS expire_le timestamptz;

ALTER TABLE public.pdf_partages_acces_log
  ADD COLUMN IF NOT EXISTS code_exemplaire text,
  ADD COLUMN IF NOT EXISTS pays text;

CREATE INDEX IF NOT EXISTS idx_pdf_acces_partage_created
  ON public.pdf_partages_acces_log (partage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_acces_code
  ON public.pdf_partages_acces_log (entreprise_id, code_exemplaire)
  WHERE code_exemplaire IS NOT NULL;

-- Le compteur de vues refuse aussi les liens expirés.
CREATE OR REPLACE FUNCTION public.increment_pdf_view(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share RECORD;
  v_updated RECORD;
BEGIN
  SELECT id, est_actif, expire_le, nombre_vues_actuel, nombre_vues_max, manuscrit_id, nom_lecteur, entreprise_lecteur
    INTO v_share
  FROM public.pdf_partages
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF NOT v_share.est_actif THEN
    RETURN jsonb_build_object('success', false, 'error', 'disabled');
  END IF;

  IF v_share.expire_le IS NOT NULL AND v_share.expire_le <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  UPDATE public.pdf_partages
     SET nombre_vues_actuel = nombre_vues_actuel + 1,
         last_viewed_at = now()
   WHERE id = v_share.id
     AND est_actif = true
     AND (expire_le IS NULL OR expire_le > now())
     AND nombre_vues_actuel < nombre_vues_max
  RETURNING nombre_vues_actuel, nombre_vues_max, manuscrit_id, nom_lecteur, entreprise_lecteur
    INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'exhausted');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'error', null,
    'views_used', v_updated.nombre_vues_actuel,
    'views_max', v_updated.nombre_vues_max,
    'manuscrit_id', v_updated.manuscrit_id,
    'nom_lecteur', v_updated.nom_lecteur,
    'entreprise_lecteur', v_updated.entreprise_lecteur
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_pdf_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_pdf_view(uuid) TO service_role;

INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Vos manuscrits partagés, mieux protégés',
  'Chaque exemplaire envoyé porte maintenant le nom du lecteur dans le fichier lui-même, et vous voyez qui l''a ouvert.',
  '2.16',
  '[
    {"type": "nouveaute", "page_concernee": "manuscrits", "texte": "Chaque lecteur reçoit un exemplaire marqué à son nom sur toutes les pages, avec un code unique : une copie qui circule montre qui l''a reçue."},
    {"type": "nouveaute", "page_concernee": "manuscrits", "texte": "Historique de chaque lien : ouvertures, tentatives refusées, captures d''écran et sorties de la fenêtre, avec la date et l''appareil."},
    {"type": "nouveaute", "page_concernee": "manuscrits", "texte": "Retrouvez un lecteur à partir du code imprimé sur une copie."},
    {"type": "nouveaute", "page_concernee": "manuscrits", "texte": "Choisissez une durée de validité pour chaque lien : 1 jour, 7 jours, 30 jours ou sans limite."},
    {"type": "amelioration", "page_concernee": "manuscrits", "texte": "Nouveau design pour le partage sécurisé et pour la page de lecture."}
  ]'::jsonb
);
