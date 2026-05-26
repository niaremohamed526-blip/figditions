
-- Add pdf storage path to manuscrits
ALTER TABLE public.manuscrits ADD COLUMN IF NOT EXISTS pdf_path TEXT;

-- pdf_partages table
CREATE TABLE IF NOT EXISTS public.pdf_partages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  manuscrit_id UUID NOT NULL REFERENCES public.manuscrits(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  nom_lecteur TEXT NOT NULL,
  email_lecteur TEXT,
  entreprise_lecteur TEXT,
  nombre_vues_max INTEGER NOT NULL DEFAULT 3,
  nombre_vues_actuel INTEGER NOT NULL DEFAULT 0,
  est_actif BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdf_partages_manuscrit ON public.pdf_partages(manuscrit_id);
CREATE INDEX IF NOT EXISTS idx_pdf_partages_token ON public.pdf_partages(token);

ALTER TABLE public.pdf_partages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ent select pdf_partages" ON public.pdf_partages FOR SELECT USING (entreprise_id = current_entreprise_id());
CREATE POLICY "ent insert pdf_partages" ON public.pdf_partages FOR INSERT WITH CHECK (entreprise_id = current_entreprise_id());
CREATE POLICY "ent update pdf_partages" ON public.pdf_partages FOR UPDATE USING (entreprise_id = current_entreprise_id());
CREATE POLICY "ent delete pdf_partages" ON public.pdf_partages FOR DELETE USING (entreprise_id = current_entreprise_id());

-- Private storage bucket for manuscript PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('manuscrits', 'manuscrits', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ent read manuscrits files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'manuscrits' AND (storage.foldername(name))[1] = current_entreprise_id()::text);
CREATE POLICY "ent upload manuscrits files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manuscrits' AND (storage.foldername(name))[1] = current_entreprise_id()::text);
CREATE POLICY "ent update manuscrits files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'manuscrits' AND (storage.foldername(name))[1] = current_entreprise_id()::text);
CREATE POLICY "ent delete manuscrits files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'manuscrits' AND (storage.foldername(name))[1] = current_entreprise_id()::text);
