
-- =========================================================
-- PART 1: Manuscript status enum rebuild (10 stages)
-- =========================================================

-- Create new enum with the 10 stages in progression order
CREATE TYPE public.manuscrit_statut_v2 AS ENUM (
  'recu',
  'relecture',
  'epreuve_1',
  'epreuve_2',
  'epreuve_3',
  'epreuve_4',
  'maquette',
  'echantillon',
  'impression',
  'publie'
);

-- Drop default so we can alter the column type
ALTER TABLE public.manuscrits ALTER COLUMN statut DROP DEFAULT;

-- Migrate column with value mapping
ALTER TABLE public.manuscrits
  ALTER COLUMN statut TYPE public.manuscrit_statut_v2
  USING (
    CASE statut::text
      WHEN 'lecture' THEN 'relecture'
      WHEN 'correction' THEN 'epreuve_1'
      ELSE statut::text
    END
  )::public.manuscrit_statut_v2;

-- Reset default
ALTER TABLE public.manuscrits ALTER COLUMN statut SET DEFAULT 'recu'::public.manuscrit_statut_v2;

-- Drop old enum and rename new one to original name
DROP TYPE public.manuscrit_statut;
ALTER TYPE public.manuscrit_statut_v2 RENAME TO manuscrit_statut;

-- =========================================================
-- PART 2: Internal stock tables
-- =========================================================

CREATE TABLE public.stock_interne (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  manuscrit_id UUID NOT NULL REFERENCES public.manuscrits(id) ON DELETE CASCADE,

  quantite_imprimee INTEGER NOT NULL DEFAULT 0,
  quantite_disponible INTEGER NOT NULL DEFAULT 0,
  quantite_reservee INTEGER NOT NULL DEFAULT 0,
  quantite_transferee_librairies INTEGER NOT NULL DEFAULT 0,
  quantite_vendue_directement INTEGER NOT NULL DEFAULT 0,
  quantite_exposee_evenements INTEGER NOT NULL DEFAULT 0,
  seuil_alerte INTEGER NOT NULL DEFAULT 10,

  prix_vente_direct_fcfa NUMERIC NOT NULL DEFAULT 0,
  cout_unitaire_impression_fcfa NUMERIC NOT NULL DEFAULT 0,

  emplacement TEXT DEFAULT 'Entrepôt principal',

  date_impression DATE,
  derniere_mise_a_jour TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (entreprise_id, manuscrit_id)
);

CREATE INDEX idx_stock_interne_entreprise ON public.stock_interne(entreprise_id);
CREATE INDEX idx_stock_interne_manuscrit ON public.stock_interne(manuscrit_id);

CREATE TABLE public.mouvements_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  stock_interne_id UUID REFERENCES public.stock_interne(id) ON DELETE SET NULL,
  manuscrit_id UUID NOT NULL REFERENCES public.manuscrits(id) ON DELETE CASCADE,

  type_mouvement TEXT NOT NULL CHECK (type_mouvement IN (
    'impression', 'transfert_librairie', 'vente_directe',
    'evenement', 'retour_librairie', 'perte', 'ajustement'
  )),
  quantite INTEGER NOT NULL,
  destination TEXT,
  notes TEXT,
  effectue_par UUID,

  date_mouvement DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mouvements_stock_entreprise ON public.mouvements_stock(entreprise_id);
CREATE INDEX idx_mouvements_stock_manuscrit ON public.mouvements_stock(manuscrit_id);
CREATE INDEX idx_mouvements_stock_stock ON public.mouvements_stock(stock_interne_id);

-- Enable RLS
ALTER TABLE public.stock_interne ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_stock ENABLE ROW LEVEL SECURITY;

-- RLS policies: company-scoped via current_entreprise_id() helper
CREATE POLICY "ent select stock_interne" ON public.stock_interne
  FOR SELECT USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert stock_interne" ON public.stock_interne
  FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update stock_interne" ON public.stock_interne
  FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete stock_interne" ON public.stock_interne
  FOR DELETE USING (entreprise_id = public.current_entreprise_id());

CREATE POLICY "ent select mouvements_stock" ON public.mouvements_stock
  FOR SELECT USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert mouvements_stock" ON public.mouvements_stock
  FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update mouvements_stock" ON public.mouvements_stock
  FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete mouvements_stock" ON public.mouvements_stock
  FOR DELETE USING (entreprise_id = public.current_entreprise_id());

-- Trigger to keep derniere_mise_a_jour fresh on stock_interne
CREATE OR REPLACE FUNCTION public.touch_stock_interne()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.derniere_mise_a_jour := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_stock_interne
  BEFORE UPDATE ON public.stock_interne
  FOR EACH ROW EXECUTE FUNCTION public.touch_stock_interne();
