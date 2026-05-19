
-- 1. Auteurs
CREATE TYPE public.mobile_money_operateur AS ENUM ('Orange Money', 'Moov Money');

CREATE TABLE public.auteurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL,
  nom_complet TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  numero_mobile_money TEXT,
  operateur public.mobile_money_operateur,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auteurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ent select auteurs" ON public.auteurs FOR SELECT
  USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert auteurs" ON public.auteurs FOR INSERT
  WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update auteurs" ON public.auteurs FOR UPDATE
  USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete auteurs" ON public.auteurs FOR DELETE
  USING (entreprise_id = public.current_entreprise_id());

CREATE INDEX idx_auteurs_entreprise ON public.auteurs(entreprise_id);

-- 2. Manuscrits: add nombre_pages and optional auteur_id link
ALTER TABLE public.manuscrits
  ADD COLUMN IF NOT EXISTS nombre_pages INTEGER,
  ADD COLUMN IF NOT EXISTS auteur_id UUID;

CREATE INDEX IF NOT EXISTS idx_manuscrits_auteur ON public.manuscrits(auteur_id);

-- 3. Stocks: extend with bookstore tracking
ALTER TABLE public.stocks
  ADD COLUMN IF NOT EXISTS librairie_nom TEXT,
  ADD COLUMN IF NOT EXISTS librairie_adresse TEXT,
  ADD COLUMN IF NOT EXISTS exemplaires_deposes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exemplaires_vendus INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS derniere_visite DATE;

-- 4. Ventes: add author royalties
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS droits_auteur_fcfa NUMERIC NOT NULL DEFAULT 0;

-- 5. Estimations de coût
CREATE TYPE public.couverture_type AS ENUM ('Souple', 'Rigide');

CREATE TABLE public.estimations_cout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL,
  manuscrit_id UUID,
  manuscrit_titre TEXT NOT NULL,
  nombre_pages INTEGER NOT NULL,
  nombre_exemplaires INTEGER NOT NULL,
  type_couverture public.couverture_type NOT NULL,
  inclure_delestage BOOLEAN NOT NULL DEFAULT false,
  cout_papier NUMERIC NOT NULL,
  cout_couverture NUMERIC NOT NULL,
  surcout_delestage NUMERIC NOT NULL,
  cout_total NUMERIC NOT NULL,
  marge_librairie NUMERIC NOT NULL,
  droits_auteur NUMERIC NOT NULL,
  prix_vente_suggere NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estimations_cout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ent select estimations" ON public.estimations_cout FOR SELECT
  USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert estimations" ON public.estimations_cout FOR INSERT
  WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update estimations" ON public.estimations_cout FOR UPDATE
  USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete estimations" ON public.estimations_cout FOR DELETE
  USING (entreprise_id = public.current_entreprise_id());

CREATE INDEX idx_estimations_entreprise ON public.estimations_cout(entreprise_id);
