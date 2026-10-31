-- Contract templates per publishing house, frozen text on signed contracts,
-- and the scanned signed copy.

-- 1. Templates ("Mes modèles de contrat")
CREATE TABLE IF NOT EXISTS public.contrat_modeles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  type_contrat text NOT NULL DEFAULT 'edition'
    CHECK (type_contrat IN ('edition', 'traduction', 'illustration', 'coedition', 'cession', 'autre')),
  titre_document text NOT NULL DEFAULT 'Contrat d''édition',
  sous_titre text,
  -- [{ "titre": "Objet du contrat", "texte": "… {auteur} …" }]
  articles jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(articles) = 'array'),
  -- A preset or the house's own colour (#rrggbb).
  couleur text NOT NULL DEFAULT 'or'
    CHECK (couleur IN ('or', 'marine', 'bordeaux', 'emeraude', 'noir') OR couleur ~ '^#[0-9A-Fa-f]{6}$'),
  style text NOT NULL DEFAULT 'classique' CHECK (style IN ('classique', 'moderne', 'epure')),
  filigrane boolean NOT NULL DEFAULT true,
  par_defaut boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel', 'exemple', 'import')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contrat_modeles_entreprise_idx ON public.contrat_modeles (entreprise_id);
-- At most one default template per house.
CREATE UNIQUE INDEX IF NOT EXISTS contrat_modeles_un_defaut
  ON public.contrat_modeles (entreprise_id) WHERE par_defaut;

ALTER TABLE public.contrat_modeles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ent select contrat_modeles" ON public.contrat_modeles;
CREATE POLICY "ent select contrat_modeles" ON public.contrat_modeles FOR SELECT TO authenticated
  USING (entreprise_id = private.current_entreprise_id());
DROP POLICY IF EXISTS "ent insert contrat_modeles" ON public.contrat_modeles;
CREATE POLICY "ent insert contrat_modeles" ON public.contrat_modeles FOR INSERT TO authenticated
  WITH CHECK (entreprise_id = private.current_entreprise_id());
DROP POLICY IF EXISTS "ent update contrat_modeles" ON public.contrat_modeles;
CREATE POLICY "ent update contrat_modeles" ON public.contrat_modeles FOR UPDATE TO authenticated
  USING (entreprise_id = private.current_entreprise_id())
  WITH CHECK (entreprise_id = private.current_entreprise_id());
DROP POLICY IF EXISTS "ent delete contrat_modeles" ON public.contrat_modeles;
CREATE POLICY "ent delete contrat_modeles" ON public.contrat_modeles FOR DELETE TO authenticated
  USING (entreprise_id = private.current_entreprise_id());

DROP TRIGGER IF EXISTS contrat_modeles_touch_updated ON public.contrat_modeles;
CREATE TRIGGER contrat_modeles_touch_updated
  BEFORE UPDATE ON public.contrat_modeles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Contracts: which template, the frozen text, the signed copy.
ALTER TABLE public.contrats
  ADD COLUMN IF NOT EXISTS modele_id uuid REFERENCES public.contrat_modeles(id) ON DELETE SET NULL,
  -- Rendered text at signature: { titre_document, sous_titre, couleur, filigrane,
  --   modele_nom, articles: [{ titre, texte }], fige_le }
  ADD COLUMN IF NOT EXISTS texte_fige jsonb,
  ADD COLUMN IF NOT EXISTS fichier_signe_path text,
  ADD COLUMN IF NOT EXISTS fichier_signe_nom text;

-- A frozen text can only be replaced on purpose (regenerate) while the
-- contract is not signed; once signed it is kept as the legal record.
CREATE OR REPLACE FUNCTION public.guard_contrat_texte_fige()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.texte_fige IS NOT NULL
     AND NEW.texte_fige IS DISTINCT FROM OLD.texte_fige
     AND OLD.statut = 'signe' AND NEW.statut = 'signe' THEN
    RAISE EXCEPTION 'Le texte d''un contrat signé ne peut pas être modifié. Passez-le d''abord en « Brouillon » pour le régénérer.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contrats_guard_texte_fige ON public.contrats;
CREATE TRIGGER contrats_guard_texte_fige
  BEFORE UPDATE OF texte_fige ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.guard_contrat_texte_fige();

-- 3. Private bucket for scanned / signed contracts: <entreprise_id>/<contrat_id>/<file>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contrats', 'contrats', false, 15728640,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ent read contrats files" ON storage.objects;
CREATE POLICY "ent read contrats files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contrats' AND (storage.foldername(name))[1] = (private.current_entreprise_id())::text);
DROP POLICY IF EXISTS "ent upload contrats files" ON storage.objects;
CREATE POLICY "ent upload contrats files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contrats' AND (storage.foldername(name))[1] = (private.current_entreprise_id())::text);
DROP POLICY IF EXISTS "ent update contrats files" ON storage.objects;
CREATE POLICY "ent update contrats files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contrats' AND (storage.foldername(name))[1] = (private.current_entreprise_id())::text);
DROP POLICY IF EXISTS "ent delete contrats files" ON storage.objects;
CREATE POLICY "ent delete contrats files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contrats' AND (storage.foldername(name))[1] = (private.current_entreprise_id())::text);
