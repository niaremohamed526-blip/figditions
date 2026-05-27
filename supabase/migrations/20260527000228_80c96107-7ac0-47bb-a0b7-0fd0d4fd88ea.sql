
CREATE TABLE public.conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id UUID NOT NULL,
  manuscrit_id UUID NULL,
  created_by UUID NULL,
  format_source TEXT NOT NULL CHECK (format_source IN ('pdf','docx','txt')),
  fichier_source_path TEXT NULL,
  taille_source_kb NUMERIC NOT NULL DEFAULT 0,
  formats_cibles TEXT[] NOT NULL DEFAULT '{}',
  titre TEXT NOT NULL,
  auteur TEXT NOT NULL,
  description TEXT NULL,
  isbn TEXT NULL,
  langue TEXT NULL DEFAULT 'français',
  editeur TEXT NULL,
  annee_publication INT NULL,
  couverture_path TEXT NULL,
  epub_path TEXT NULL,
  mobi_path TEXT NULL,
  taille_epub_kb NUMERIC NULL,
  taille_mobi_kb NUMERIC NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','en_cours','termine','echec')),
  erreur_message TEXT NULL,
  duree_conversion_secondes INT NULL,
  cloudconvert_job_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_conversions_entreprise ON public.conversions(entreprise_id, created_at DESC);
CREATE INDEX idx_conversions_manuscrit ON public.conversions(manuscrit_id);
CREATE INDEX idx_conversions_statut ON public.conversions(statut);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversions TO authenticated;
GRANT ALL ON public.conversions TO service_role;

ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ent select conversions" ON public.conversions
  FOR SELECT USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert conversions" ON public.conversions
  FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update conversions" ON public.conversions
  FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete conversions" ON public.conversions
  FOR DELETE USING (entreprise_id = public.current_entreprise_id());

CREATE TRIGGER trg_conversions_updated_at
  BEFORE UPDATE ON public.conversions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('conversions', 'conversions', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ent read conversion files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'conversions' AND (storage.foldername(name))[1] = public.current_entreprise_id()::text);

CREATE POLICY "ent insert conversion files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'conversions' AND (storage.foldername(name))[1] = public.current_entreprise_id()::text);

CREATE POLICY "ent update conversion files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'conversions' AND (storage.foldername(name))[1] = public.current_entreprise_id()::text);

CREATE POLICY "ent delete conversion files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'conversions' AND (storage.foldername(name))[1] = public.current_entreprise_id()::text);
