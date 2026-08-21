CREATE OR REPLACE FUNCTION public.trg_ventes_fill_auteur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ms record;
  v_aid uuid;
BEGIN
  IF NEW.auteur_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT auteur, auteur_id INTO v_ms
  FROM public.manuscrits
  WHERE id = NEW.manuscrit_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_ms.auteur_id IS NOT NULL THEN
    NEW.auteur_id := v_ms.auteur_id;
    RETURN NEW;
  END IF;

  IF v_ms.auteur IS NOT NULL AND btrim(v_ms.auteur) <> '' THEN
    SELECT a.id INTO v_aid
    FROM public.auteurs a
    WHERE a.entreprise_id = NEW.entreprise_id
      AND lower(regexp_replace(btrim(a.nom_complet), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(v_ms.auteur), '\s+', ' ', 'g'))
    ORDER BY a.created_at
    LIMIT 1;

    IF v_aid IS NULL THEN
      INSERT INTO public.auteurs (entreprise_id, nom_complet)
      VALUES (NEW.entreprise_id, btrim(v_ms.auteur))
      RETURNING id INTO v_aid;
    END IF;

    UPDATE public.manuscrits SET auteur_id = v_aid WHERE id = NEW.manuscrit_id;
    NEW.auteur_id := v_aid;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_ventes_fill_auteur() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ventes_fill_auteur ON public.ventes;
CREATE TRIGGER trg_ventes_fill_auteur
BEFORE INSERT OR UPDATE OF manuscrit_id, auteur_id ON public.ventes
FOR EACH ROW EXECUTE FUNCTION public.trg_ventes_fill_auteur();