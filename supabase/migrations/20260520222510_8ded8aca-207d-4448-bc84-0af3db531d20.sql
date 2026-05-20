ALTER TABLE public.stocks ADD COLUMN IF NOT EXISTS prix_unitaire_fcfa numeric NOT NULL DEFAULT 0;

ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS auteur_id uuid;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS quantite_vendue integer NOT NULL DEFAULT 0;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS prix_unitaire_fcfa numeric NOT NULL DEFAULT 0;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS montant_total_fcfa numeric NOT NULL DEFAULT 0;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS date_vente date NOT NULL DEFAULT CURRENT_DATE;