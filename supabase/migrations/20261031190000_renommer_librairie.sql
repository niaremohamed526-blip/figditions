-- Rename a bookshop (and optionally set its address) everywhere in one
-- transaction: deposits, deposit history, sales, bordereaux and Medmo's
-- learned corrections. Refuses a name already used by another bookshop.
CREATE OR REPLACE FUNCTION public.renommer_librairie(
  p_ancien text,
  p_nouveau text,
  p_adresse text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent uuid;
  v_role text;
  v_perm jsonb;
  v_old text := btrim(coalesce(p_ancien, ''));
  v_new text := btrim(coalesce(p_nouveau, ''));
  v_adr text := nullif(btrim(coalesce(p_adresse, '')), '');
  n_stocks int := 0;
  n_depots int := 0;
  n_ventes int := 0;
  n_bordereaux int := 0;
BEGIN
  SELECT entreprise_id, role::text, permissions INTO v_ent, v_role, v_perm
  FROM public.profiles WHERE id = auth.uid();
  IF v_ent IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable';
  END IF;
  IF v_role <> 'admin' AND coalesce((v_perm->>'stocks_externe')::boolean, false) = false THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de modifier les librairies';
  END IF;
  IF v_old = '' OR v_new = '' THEN
    RAISE EXCEPTION 'Le nom de la librairie ne peut pas être vide';
  END IF;

  -- A different bookshop already uses this name (a pure case change is fine).
  IF lower(v_new) <> lower(v_old) AND (
    EXISTS (SELECT 1 FROM public.stocks WHERE entreprise_id = v_ent AND lower(btrim(librairie_nom)) = lower(v_new))
    OR EXISTS (SELECT 1 FROM public.ventes WHERE entreprise_id = v_ent AND lower(btrim(librairie_nom)) = lower(v_new))
  ) THEN
    RAISE EXCEPTION 'Une librairie « % » existe déjà. Choisissez un autre nom.', v_new;
  END IF;

  UPDATE public.stocks
     SET librairie_nom = v_new,
         librairie_adresse = coalesce(v_adr, librairie_adresse)
   WHERE entreprise_id = v_ent AND lower(btrim(librairie_nom)) = lower(v_old);
  GET DIAGNOSTICS n_stocks = ROW_COUNT;
  IF n_stocks = 0 THEN
    RAISE EXCEPTION 'Librairie « % » introuvable', v_old;
  END IF;

  UPDATE public.depot_batches SET librairie_nom = v_new
   WHERE entreprise_id = v_ent AND lower(btrim(librairie_nom)) = lower(v_old);
  GET DIAGNOSTICS n_depots = ROW_COUNT;

  UPDATE public.ventes SET librairie_nom = v_new
   WHERE entreprise_id = v_ent AND lower(btrim(librairie_nom)) = lower(v_old);
  GET DIAGNOSTICS n_ventes = ROW_COUNT;

  UPDATE public.bordereaux
     SET librairie_nom = v_new,
         librairie_adresse = coalesce(v_adr, librairie_adresse)
   WHERE entreprise_id = v_ent AND lower(btrim(librairie_nom)) = lower(v_old);
  GET DIAGNOSTICS n_bordereaux = ROW_COUNT;

  UPDATE public.medmo_ocr_corrections SET valeur_correcte = v_new
   WHERE entreprise_id = v_ent AND type_correction = 'librairie'
     AND lower(btrim(valeur_correcte)) = lower(v_old);

  RETURN jsonb_build_object(
    'ok', true, 'stocks', n_stocks, 'depots', n_depots,
    'ventes', n_ventes, 'bordereaux', n_bordereaux
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.renommer_librairie(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.renommer_librairie(text, text, text) TO authenticated, service_role;
