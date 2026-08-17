CREATE OR REPLACE FUNCTION public.apply_depot_transfert(
  p_manuscrit_id uuid,
  p_delta integer,
  p_librairie_nom text DEFAULT NULL,
  p_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent uuid;
  v_si public.stock_interne;
  v_applied integer;
  v_warning text := NULL;
  v_date date := COALESCE(p_date, CURRENT_DATE);
BEGIN
  IF p_manuscrit_id IS NULL OR COALESCE(p_delta, 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'applied', 0);
  END IF;

  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = auth.uid();
  IF v_ent IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil sans entreprise');
  END IF;

  PERFORM 1 FROM public.manuscrits
   WHERE id = p_manuscrit_id AND entreprise_id = v_ent;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manuscrit introuvable');
  END IF;

  SELECT * INTO v_si FROM public.stock_interne
   WHERE manuscrit_id = p_manuscrit_id AND entreprise_id = v_ent
   FOR UPDATE;

  IF NOT FOUND THEN
    IF p_delta < 0 THEN
      RETURN jsonb_build_object('ok', true, 'applied', 0);
    END IF;
    INSERT INTO public.stock_interne (
      entreprise_id, manuscrit_id, quantite_imprimee, quantite_disponible,
      quantite_transferee_librairies, date_impression
    ) VALUES (v_ent, p_manuscrit_id, p_delta, p_delta, 0, v_date)
    RETURNING * INTO v_si;
    v_warning := 'Fiche entrepôt créée automatiquement';
  END IF;

  IF p_delta > 0 THEN
    v_applied := LEAST(p_delta, GREATEST(v_si.quantite_disponible, 0));
    IF v_applied < p_delta THEN
      v_warning := COALESCE(v_warning || ' — ', '') ||
        'Entrepôt insuffisant : ' || v_applied || ' exemplaire(s) déduit(s) sur ' || p_delta;
    END IF;
    UPDATE public.stock_interne
       SET quantite_disponible = GREATEST(quantite_disponible - v_applied, 0),
           quantite_transferee_librairies = quantite_transferee_librairies + p_delta,
           derniere_mise_a_jour = now()
     WHERE id = v_si.id;

    INSERT INTO public.mouvements_stock (
      entreprise_id, stock_interne_id, manuscrit_id, type_mouvement,
      quantite, destination, notes, effectue_par, date_mouvement
    ) VALUES (
      v_ent, v_si.id, p_manuscrit_id, 'transfert_librairie',
      p_delta, p_librairie_nom, 'Dépôt en librairie', auth.uid(), v_date
    );
  ELSE
    v_applied := -p_delta;
    UPDATE public.stock_interne
       SET quantite_disponible = quantite_disponible + v_applied,
           quantite_transferee_librairies = GREATEST(quantite_transferee_librairies - v_applied, 0),
           derniere_mise_a_jour = now()
     WHERE id = v_si.id;

    INSERT INTO public.mouvements_stock (
      entreprise_id, stock_interne_id, manuscrit_id, type_mouvement,
      quantite, destination, notes, effectue_par, date_mouvement
    ) VALUES (
      v_ent, v_si.id, p_manuscrit_id, 'retour_librairie',
      v_applied, p_librairie_nom, 'Correction du dépôt en librairie', auth.uid(), v_date
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'applied', v_applied, 'warning', v_warning);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_depot_transfert(uuid, integer, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_depot_transfert(uuid, integer, text, date) TO authenticated;