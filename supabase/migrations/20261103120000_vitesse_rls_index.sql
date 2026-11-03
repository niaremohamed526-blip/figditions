-- v2.17 : pages plus rapides.
-- 1. Les règles de sécurité (RLS) recalculaient auth.uid() pour chaque ligne lue.
--    Même règle, mais calculée une seule fois par requête : ( SELECT auth.uid() ).
--    Recommandation officielle Supabase ; le résultat est strictement identique.
-- 2. Index sur les clés étrangères qui n'en avaient pas (ventes, stocks, profils...).
-- Annulation : voir 20261103120000_vitesse_rls_index.ANNULER.sql

-- Copie des règles avant modification, pour pouvoir revenir en arrière.
CREATE TABLE IF NOT EXISTS public._sauvegarde_politiques_v217 (
  tablename  text NOT NULL,
  policyname text NOT NULL,
  qual       text,
  with_check text,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tablename, policyname)
);
ALTER TABLE public._sauvegarde_politiques_v217 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._sauvegarde_politiques_v217 FROM PUBLIC, anon, authenticated;

INSERT INTO public._sauvegarde_politiques_v217 (tablename, policyname, qual, with_check)
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ON CONFLICT (tablename, policyname) DO NOTHING;

DO $$
DECLARE
  p record;
  motif constant text := 'auth\.(uid|jwt|role)\(\)';
  remplacement constant text := '( SELECT auth.\1() AS \1)';
  nouveau_using text;
  nouveau_check text;
  n int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ motif
      -- Règles déjà optimisées : on n'y touche pas.
      AND (coalesce(qual, '') || coalesce(with_check, '')) !~ 'SELECT auth\.(uid|jwt|role)\(\)'
  LOOP
    nouveau_using := CASE WHEN p.qual IS NULL THEN NULL ELSE regexp_replace(p.qual, motif, remplacement, 'g') END;
    nouveau_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE regexp_replace(p.with_check, motif, remplacement, 'g') END;

    IF nouveau_using IS NOT NULL AND nouveau_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', p.policyname, p.tablename, nouveau_using, nouveau_check);
    ELSIF nouveau_using IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', p.policyname, p.tablename, nouveau_using);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', p.policyname, p.tablename, nouveau_check);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE '% règles optimisées', n;
END $$;

-- Index des clés étrangères.
CREATE INDEX IF NOT EXISTS idx_bordereaux_created_by ON public.bordereaux (created_by);
CREATE INDEX IF NOT EXISTS idx_depenses_entreprise_id ON public.depenses (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_depenses_manuscrit_id ON public.depenses (manuscrit_id);
CREATE INDEX IF NOT EXISTS idx_depot_batches_annulee_par ON public.depot_batches (annulee_par);
CREATE INDEX IF NOT EXISTS idx_depot_batches_manuscrit_id ON public.depot_batches (manuscrit_id);
CREATE INDEX IF NOT EXISTS idx_entreprises_owner_id ON public.entreprises (owner_id);
CREATE INDEX IF NOT EXISTS idx_medmo_ocr_corrections_entreprise_id ON public.medmo_ocr_corrections (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_medmo_ocr_corrections_user_id ON public.medmo_ocr_corrections (user_id);
CREATE INDEX IF NOT EXISTS idx_medmo_ocr_logs_entreprise_id ON public.medmo_ocr_logs (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_medmo_ocr_logs_user_id ON public.medmo_ocr_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_annulee_par ON public.mouvements_stock (annulee_par);
CREATE INDEX IF NOT EXISTS idx_paiements_confirme_par ON public.paiements (confirme_par);
CREATE INDEX IF NOT EXISTS idx_paiements_royalties_annulee_par ON public.paiements_royalties (annulee_par);
CREATE INDEX IF NOT EXISTS idx_paiements_royalties_entreprise_id ON public.paiements_royalties (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_pdf_partages_entreprise_id ON public.pdf_partages (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_profiles_entreprise_id ON public.profiles (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_entreprise_id ON public.promo_code_redemptions (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_entreprise_id ON public.push_subscriptions (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stocks_entreprise_id ON public.stocks (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stocks_manuscrit_id ON public.stocks (manuscrit_id);
CREATE INDEX IF NOT EXISTS idx_ventes_annulee_par ON public.ventes (annulee_par);
CREATE INDEX IF NOT EXISTS idx_ventes_entreprise_id ON public.ventes (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_ventes_manuscrit_id ON public.ventes (manuscrit_id);
CREATE INDEX IF NOT EXISTS idx_ventes_stock_id ON public.ventes (stock_id);
CREATE INDEX IF NOT EXISTS idx_contrat_modeles_created_by ON public.contrat_modeles (created_by);
CREATE INDEX IF NOT EXISTS idx_contrats_modele_id ON public.contrats (modele_id);
CREATE INDEX IF NOT EXISTS idx_medmo_usage_user_id ON public.medmo_usage (user_id);

INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'FIGDITIONS plus rapide',
  'Vos listes de ventes, de stocks et de dépenses s''affichent plus vite, surtout quand vos données grandissent.',
  '2.17',
  '[
    {"type": "amelioration", "page_concernee": "global", "texte": "Les listes de ventes, de stocks, de dépenses et de bordereaux se chargent plus vite."},
    {"type": "amelioration", "page_concernee": "global", "texte": "Les polices de l''application sont maintenant chargées depuis FIGDITIONS : premier affichage plus rapide, et texte correct même sans connexion."},
    {"type": "amelioration", "page_concernee": "parametres", "texte": "Le paiement d''abonnement ne reste plus bloqué si le service de paiement ne répond pas."}
  ]'::jsonb
);
