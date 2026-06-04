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
  SELECT id, est_actif, nombre_vues_actuel, nombre_vues_max, manuscrit_id, nom_lecteur, entreprise_lecteur
    INTO v_share
  FROM public.pdf_partages
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF NOT v_share.est_actif THEN
    RETURN jsonb_build_object('success', false, 'error', 'disabled');
  END IF;

  UPDATE public.pdf_partages
     SET nombre_vues_actuel = nombre_vues_actuel + 1,
         last_viewed_at = now()
   WHERE id = v_share.id
     AND est_actif = true
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