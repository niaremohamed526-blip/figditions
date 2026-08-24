ALTER TABLE public.manuscrits
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'propre',
  ADD COLUMN IF NOT EXISTS editeur_origine text;

ALTER TABLE public.manuscrits
  DROP CONSTRAINT IF EXISTS manuscrits_origine_valide;

ALTER TABLE public.manuscrits
  ADD CONSTRAINT manuscrits_origine_valide CHECK (origine IN ('propre', 'etranger'));

CREATE INDEX IF NOT EXISTS idx_manuscrits_entreprise_origine
  ON public.manuscrits(entreprise_id, origine);

COMMENT ON COLUMN public.manuscrits.origine IS 'propre = livre publié par la maison; etranger = livre acquis auprès d’un autre éditeur (distribution)';
COMMENT ON COLUMN public.manuscrits.editeur_origine IS 'Maison d’édition d’origine (livres étrangers uniquement)';