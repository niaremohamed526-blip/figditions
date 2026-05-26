
-- 1. Add expiry column to entreprises
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS abonnement_expire_le TIMESTAMPTZ;

-- 2. abonnements table
CREATE TABLE IF NOT EXISTS public.abonnements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro','business')),
  periode TEXT NOT NULL CHECK (periode IN ('mensuel','annuel')),
  montant_fcfa NUMERIC NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','actif','echec','annule','expire')),
  paydunya_token TEXT,
  paydunya_checkout_url TEXT,
  date_debut TIMESTAMPTZ,
  date_fin TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abonnements_entreprise ON public.abonnements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_token ON public.abonnements(paydunya_token);

ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ent select abonnements" ON public.abonnements
  FOR SELECT USING (entreprise_id = public.current_entreprise_id());

CREATE POLICY "ent insert abonnements" ON public.abonnements
  FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());

-- No update/delete policies for users: only service role (webhook) can mutate status.

-- 3. paiements table
CREATE TABLE IF NOT EXISTS public.paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id UUID NOT NULL REFERENCES public.abonnements(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL,
  montant_fcfa NUMERIC NOT NULL,
  methode TEXT CHECK (methode IN ('orange_money','carte_bancaire','autre')),
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','succes','echec')),
  paydunya_token TEXT,
  paydunya_reference TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paiements_entreprise ON public.paiements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_paiements_abonnement ON public.paiements(abonnement_id);

ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ent select paiements" ON public.paiements
  FOR SELECT USING (entreprise_id = public.current_entreprise_id());

-- Only service role can insert/update payments (webhook).

-- 4. updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_abonnements_touch ON public.abonnements;
CREATE TRIGGER trg_abonnements_touch BEFORE UPDATE ON public.abonnements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_paiements_touch ON public.paiements;
CREATE TRIGGER trg_paiements_touch BEFORE UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
