CREATE TABLE public.pdf_partages_acces_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partage_id UUID REFERENCES public.pdf_partages(id) ON DELETE CASCADE,
  token UUID NOT NULL,
  entreprise_id UUID,
  resultat TEXT NOT NULL,
  raison TEXT,
  ip_addr TEXT,
  user_agent TEXT,
  nom_saisi TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdf_acces_token_created ON public.pdf_partages_acces_log(token, created_at DESC);
CREATE INDEX idx_pdf_acces_entreprise ON public.pdf_partages_acces_log(entreprise_id, created_at DESC);

GRANT SELECT ON public.pdf_partages_acces_log TO authenticated;
GRANT ALL ON public.pdf_partages_acces_log TO service_role;

ALTER TABLE public.pdf_partages_acces_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membres de l'entreprise peuvent voir le journal"
  ON public.pdf_partages_acces_log FOR SELECT
  TO authenticated
  USING (
    entreprise_id IN (
      SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()
    )
  );