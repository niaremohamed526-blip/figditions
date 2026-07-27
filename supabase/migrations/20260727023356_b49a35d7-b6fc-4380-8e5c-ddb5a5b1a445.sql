
ALTER TYPE public.contrat_statut ADD VALUE IF NOT EXISTS 'resilie';

ALTER TABLE public.contrats
  ADD COLUMN IF NOT EXISTS nif_editeur text,
  ADD COLUMN IF NOT EXISTS rccm_editeur text,
  ADD COLUMN IF NOT EXISTS nina_editeur text,
  ADD COLUMN IF NOT EXISTS compte_bancaire text,
  ADD COLUMN IF NOT EXISTS banque text,
  ADD COLUMN IF NOT EXISTS livres jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS territoire_mali numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS territoire_ci numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS territoire_senegal numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS territoire_france numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS duree_annees integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS contribution_auteur text,
  ADD COLUMN IF NOT EXISTS lieu_signature text NOT NULL DEFAULT 'Bamako',
  ADD COLUMN IF NOT EXISTS nom_representant_editeur text,
  ADD COLUMN IF NOT EXISTS qualite_representant text,
  ADD COLUMN IF NOT EXISTS adresse_auteur text,
  ADD COLUMN IF NOT EXISTS telephone_auteur text,
  ADD COLUMN IF NOT EXISTS profession_auteur text,
  ADD COLUMN IF NOT EXISTS tirage_minimum integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS exemplaires_auteur integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cachet_url text,
  ADD COLUMN IF NOT EXISTS collection text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS type_couverture text,
  ADD COLUMN IF NOT EXISTS reliure text,
  ADD COLUMN IF NOT EXISTS frequence_paiement text NOT NULL DEFAULT 'annuel';

ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS rccm text,
  ADD COLUMN IF NOT EXISTS nina text,
  ADD COLUMN IF NOT EXISTS compte_bancaire text,
  ADD COLUMN IF NOT EXISTS banque text,
  ADD COLUMN IF NOT EXISTS nom_representant text,
  ADD COLUMN IF NOT EXISTS qualite_representant text,
  ADD COLUMN IF NOT EXISTS cachet_url text,
  ADD COLUMN IF NOT EXISTS adresse text,
  ADD COLUMN IF NOT EXISTS telephone text,
  ADD COLUMN IF NOT EXISTS email_contact text,
  ADD COLUMN IF NOT EXISTS website text;
