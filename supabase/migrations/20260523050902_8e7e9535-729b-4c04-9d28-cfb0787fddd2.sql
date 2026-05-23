
-- 1. Extend entreprises
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Contrats table
DO $$ BEGIN
  CREATE TYPE public.contrat_statut AS ENUM ('brouillon', 'signe', 'expire');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contrats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL,
  manuscrit_id UUID NOT NULL,
  auteur_id UUID,
  pourcentage_droits NUMERIC NOT NULL DEFAULT 10,
  duree TEXT NOT NULL DEFAULT '3 ans',
  statut public.contrat_statut NOT NULL DEFAULT 'brouillon',
  notes TEXT,
  date_signature DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contrats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ent select contrats" ON public.contrats;
CREATE POLICY "ent select contrats" ON public.contrats FOR SELECT
  USING (entreprise_id = public.current_entreprise_id());
DROP POLICY IF EXISTS "ent insert contrats" ON public.contrats;
CREATE POLICY "ent insert contrats" ON public.contrats FOR INSERT
  WITH CHECK (entreprise_id = public.current_entreprise_id());
DROP POLICY IF EXISTS "ent update contrats" ON public.contrats;
CREATE POLICY "ent update contrats" ON public.contrats FOR UPDATE
  USING (entreprise_id = public.current_entreprise_id());
DROP POLICY IF EXISTS "ent delete contrats" ON public.contrats;
CREATE POLICY "ent delete contrats" ON public.contrats FOR DELETE
  USING (entreprise_id = public.current_entreprise_id());

-- 3. Logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos auth upload" ON storage.objects;
CREATE POLICY "logos auth upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = public.current_entreprise_id()::text);

DROP POLICY IF EXISTS "logos auth update" ON storage.objects;
CREATE POLICY "logos auth update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = public.current_entreprise_id()::text);

DROP POLICY IF EXISTS "logos auth delete" ON storage.objects;
CREATE POLICY "logos auth delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = public.current_entreprise_id()::text);
