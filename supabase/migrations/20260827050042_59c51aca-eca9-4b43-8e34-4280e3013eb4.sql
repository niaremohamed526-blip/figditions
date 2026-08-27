CREATE TABLE IF NOT EXISTS public.depot_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  stock_id uuid REFERENCES public.stocks(id) ON DELETE SET NULL,
  manuscrit_id uuid NOT NULL REFERENCES public.manuscrits(id) ON DELETE CASCADE,
  librairie_nom text NOT NULL,
  quantite_deposee integer NOT NULL,
  date_depot date NOT NULL DEFAULT CURRENT_DATE,
  bordereau_id uuid,
  provenance text NOT NULL DEFAULT 'interne',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS depot_batches_lookup_idx
  ON public.depot_batches (entreprise_id, manuscrit_id, librairie_nom, date_depot);
CREATE INDEX IF NOT EXISTS depot_batches_stock_idx ON public.depot_batches (stock_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.depot_batches TO authenticated;
GRANT ALL ON public.depot_batches TO service_role;

ALTER TABLE public.depot_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "depot_batches select same entreprise" ON public.depot_batches
  FOR SELECT TO authenticated
  USING (entreprise_id = (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "depot_batches insert same entreprise" ON public.depot_batches
  FOR INSERT TO authenticated
  WITH CHECK (entreprise_id = (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "depot_batches update same entreprise" ON public.depot_batches
  FOR UPDATE TO authenticated
  USING (entreprise_id = (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (entreprise_id = (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "depot_batches delete same entreprise" ON public.depot_batches
  FOR DELETE TO authenticated
  USING (entreprise_id = (SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()));

-- Amorçage de l'historique depuis les dépôts existants
INSERT INTO public.depot_batches (entreprise_id, stock_id, manuscrit_id, librairie_nom, quantite_deposee, date_depot, provenance, notes)
SELECT s.entreprise_id, s.id, s.manuscrit_id,
       COALESCE(NULLIF(btrim(s.librairie_nom), ''), 'Sans librairie'),
       GREATEST(COALESCE(s.exemplaires_deposes, 0), 0),
       COALESCE(s.derniere_visite, s.created_at::date, CURRENT_DATE),
       COALESCE(s.provenance, 'interne'),
       'Dépôt initial (historique reconstitué)'
FROM public.stocks s
WHERE COALESCE(s.exemplaires_deposes, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.depot_batches b WHERE b.stock_id = s.id);

-- Ajout d'un dépôt : fusionne dans la fiche existante + journalise le lot
CREATE OR REPLACE FUNCTION public.add_depot_batch(
  p_manuscrit_id uuid,
  p_librairie_nom text,
  p_quantite integer,
  p_prix numeric DEFAULT NULL,
  p_librairie_adresse text DEFAULT NULL,
  p_date date DEFAULT NULL,
  p_provenance text DEFAULT 'interne',
  p_taux_commission numeric DEFAULT NULL,
  p_applique_droits boolean DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ent uuid;
  v_row public.stocks;
  v_nom text := NULLIF(btrim(COALESCE(p_librairie_nom, '')), '');
  v_qte integer := GREATEST(0, COALESCE(p_quantite, 0));
  v_date date := COALESCE(p_date, CURRENT_DATE);
  v_prov text := CASE WHEN p_provenance = 'hors_stock' THEN 'hors_stock' ELSE 'interne' END;
  v_avant integer := 0;
  v_warning text := NULL;
  v_res jsonb;
  v_batch uuid;
BEGIN
  SELECT entreprise_id INTO v_ent FROM public.profiles WHERE id = auth.uid();
  IF v_ent IS NULL THEN RAISE EXCEPTION 'Aucune entreprise associée à votre compte'; END IF;
  IF v_nom IS NULL THEN RAISE EXCEPTION 'Nom de la librairie requis'; END IF;
  IF v_qte <= 0 THEN RAISE EXCEPTION 'Quantité invalide'; END IF;

  PERFORM 1 FROM public.manuscrits WHERE id = p_manuscrit_id AND entreprise_id = v_ent;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manuscrit introuvable'; END IF;

  SELECT * INTO v_row FROM public.stocks
   WHERE entreprise_id = v_ent
     AND manuscrit_id = p_manuscrit_id
     AND btrim(lower(COALESCE(librairie_nom, ''))) = btrim(lower(v_nom))
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    v_avant := COALESCE(v_row.exemplaires_restants, 0);
    UPDATE public.stocks SET
      exemplaires_deposes = COALESCE(exemplaires_deposes, 0) + v_qte,
      exemplaires_restants = COALESCE(exemplaires_restants, 0) + v_qte,
      exemplaires_total = COALESCE(exemplaires_deposes, 0) + v_qte,
      librairie_adresse = COALESCE(NULLIF(btrim(COALESCE(p_librairie_adresse, '')), ''), librairie_adresse),
      prix_unitaire_fcfa = COALESCE(NULLIF(p_prix, 0), prix_unitaire_fcfa),
      taux_commission_pct = COALESCE(p_taux_commission, taux_commission_pct),
      applique_droits_auteur = COALESCE(p_applique_droits, applique_droits_auteur),
      derniere_visite = v_date
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.stocks (entreprise_id, manuscrit_id, librairie_nom, librairie_adresse,
      exemplaires_deposes, exemplaires_vendus, exemplaires_restants, exemplaires_total,
      prix_unitaire_fcfa, derniere_visite, taux_commission_pct, applique_droits_auteur, provenance)
    VALUES (v_ent, p_manuscrit_id, v_nom, NULLIF(btrim(COALESCE(p_librairie_adresse, '')), ''),
      v_qte, 0, v_qte, v_qte, COALESCE(p_prix, 0), v_date,
      COALESCE(p_taux_commission, 20), COALESCE(p_applique_droits, true), v_prov)
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.depot_batches (entreprise_id, stock_id, manuscrit_id, librairie_nom,
    quantite_deposee, date_depot, provenance, notes, created_by)
  VALUES (v_ent, v_row.id, p_manuscrit_id, v_nom, v_qte, v_date, v_prov, p_notes, auth.uid())
  RETURNING id INTO v_batch;

  IF v_prov <> 'hors_stock' THEN
    v_res := public.apply_depot_transfert(p_manuscrit_id, v_qte, v_nom, v_date);
    v_warning := v_res->>'warning';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'stock_id', v_row.id,
    'batch_id', v_batch,
    'avant', v_avant,
    'ajout', v_qte,
    'total_restants', v_row.exemplaires_restants,
    'total_deposes', v_row.exemplaires_deposes,
    'vendus', v_row.exemplaires_vendus,
    'merged', v_avant > 0 OR (v_row.exemplaires_deposes > v_qte),
    'warning', v_warning
  );
END; $function$;

REVOKE ALL ON FUNCTION public.add_depot_batch(uuid, text, integer, numeric, text, date, text, numeric, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.add_depot_batch(uuid, text, integer, numeric, text, date, text, numeric, boolean, text) TO authenticated;