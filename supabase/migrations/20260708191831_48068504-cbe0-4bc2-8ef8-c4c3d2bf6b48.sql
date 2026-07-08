CREATE OR REPLACE FUNCTION public.create_bordereau(p_type text, p_librairie_nom text, p_librairie_adresse text, p_periode_debut date, p_periode_fin date, p_lignes jsonb, p_total_exemplaires integer, p_total_fcfa numeric, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ent uuid;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_next int;
  v_numero text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = v_uid;
  IF v_ent IS NULL THEN
    RAISE EXCEPTION 'Profil sans entreprise';
  END IF;

  -- Serialize numbering per entreprise+year using an advisory lock
  PERFORM pg_advisory_xact_lock(hashtextextended('bordereau:' || v_ent::text || ':' || v_year::text, 0));

  SELECT COALESCE(MAX(
    CAST(regexp_replace(numero, '^BRD-\d{4}-', '') AS integer)
  ), 0) + 1
    INTO v_next
  FROM public.bordereaux
  WHERE entreprise_id = v_ent
    AND annee = v_year;

  v_numero := 'BRD-' || v_year::text || '-' || lpad(v_next::text, 4, '0');

  INSERT INTO public.bordereaux(
    entreprise_id, numero, annee, type, librairie_nom, librairie_adresse,
    periode_debut, periode_fin, lignes, total_exemplaires, total_fcfa, notes, created_by
  ) VALUES (
    v_ent, v_numero, v_year, p_type, p_librairie_nom, p_librairie_adresse,
    p_periode_debut, p_periode_fin, p_lignes, p_total_exemplaires, p_total_fcfa, p_notes, v_uid
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$function$;