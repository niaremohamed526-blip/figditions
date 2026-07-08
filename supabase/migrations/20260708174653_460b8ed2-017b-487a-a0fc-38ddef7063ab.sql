-- Bordereaux table
CREATE TABLE public.bordereaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  numero text NOT NULL,
  annee integer NOT NULL,
  type text NOT NULL CHECK (type IN ('depot', 'vente')),
  librairie_nom text NOT NULL,
  librairie_adresse text,
  periode_debut date,
  periode_fin date,
  lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_exemplaires integer NOT NULL DEFAULT 0,
  total_fcfa numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entreprise_id, numero)
);

CREATE INDEX idx_bordereaux_entreprise ON public.bordereaux(entreprise_id, created_at DESC);
CREATE INDEX idx_bordereaux_librairie ON public.bordereaux(entreprise_id, librairie_nom);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bordereaux TO authenticated;
GRANT ALL ON public.bordereaux TO service_role;

ALTER TABLE public.bordereaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membres de l'entreprise peuvent voir les bordereaux"
  ON public.bordereaux FOR SELECT TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Membres de l'entreprise peuvent créer des bordereaux"
  ON public.bordereaux FOR INSERT TO authenticated
  WITH CHECK (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Membres de l'entreprise peuvent modifier les bordereaux"
  ON public.bordereaux FOR UPDATE TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Membres de l'entreprise peuvent supprimer les bordereaux"
  ON public.bordereaux FOR DELETE TO authenticated
  USING (entreprise_id IN (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER bordereaux_touch_updated
  BEFORE UPDATE ON public.bordereaux
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Plan enforcement: Business only
CREATE OR REPLACE FUNCTION public.enforce_plan_bordereaux()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_plan text;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT plan INTO v_plan FROM public.entreprises WHERE id = NEW.entreprise_id;
  IF COALESCE(v_plan, 'starter') <> 'business' THEN
    RAISE EXCEPTION 'Les bordereaux sont réservés au plan Business';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bordereaux_plan_check
  BEFORE INSERT ON public.bordereaux
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_bordereaux();

-- Atomic numbering + insert
CREATE OR REPLACE FUNCTION public.create_bordereau(
  p_type text,
  p_librairie_nom text,
  p_librairie_adresse text,
  p_periode_debut date,
  p_periode_fin date,
  p_lignes jsonb,
  p_total_exemplaires integer,
  p_total_fcfa numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Lock rows for this entreprise+year to compute next number
  SELECT COALESCE(MAX(
    CAST(regexp_replace(numero, '^BRD-\d{4}-', '') AS integer)
  ), 0) + 1
    INTO v_next
  FROM public.bordereaux
  WHERE entreprise_id = v_ent
    AND annee = v_year
  FOR UPDATE;

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
$$;

GRANT EXECUTE ON FUNCTION public.create_bordereau(text, text, text, date, date, jsonb, integer, numeric, text) TO authenticated;