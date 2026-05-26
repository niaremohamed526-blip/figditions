
-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL,
  type text NOT NULL,
  titre text NOT NULL,
  message text NOT NULL,
  lien text,
  lu boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_entreprise_created
  ON public.notifications (entreprise_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ent select notifications" ON public.notifications;
CREATE POLICY "ent select notifications" ON public.notifications
  FOR SELECT USING (entreprise_id = public.current_entreprise_id());

DROP POLICY IF EXISTS "ent update notifications" ON public.notifications;
CREATE POLICY "ent update notifications" ON public.notifications
  FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
-- INSERT / DELETE intentionally only via service role / triggers.

-- ============================================================
-- 2. REALTIME PUBLICATION
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'manuscrits','auteurs','stocks','stock_interne','mouvements_stock',
    'ventes','contrats','entreprises','notifications','abonnements','paiements'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN NULL;
    END;
  END LOOP;
END$$;

-- ============================================================
-- 3. HELPER: insert notification
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notify(
  p_entreprise uuid, p_type text, p_titre text, p_message text,
  p_lien text DEFAULT NULL, p_metadata jsonb DEFAULT NULL
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications(entreprise_id, type, titre, message, lien, metadata)
  VALUES (p_entreprise, p_type, p_titre, p_message, p_lien, p_metadata);
$$;

-- ============================================================
-- 4. TRIGGER: manuscrit publié → crée stock_interne + notifie
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_manuscrit_publie()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.statut = 'publie' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'publie') THEN
    INSERT INTO public.stock_interne(entreprise_id, manuscrit_id)
    SELECT NEW.entreprise_id, NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_interne
      WHERE manuscrit_id = NEW.id AND entreprise_id = NEW.entreprise_id
    );

    PERFORM public.fn_notify(
      NEW.entreprise_id, 'manuscrit_publie',
      '📘 Livre publié',
      'Le manuscrit « ' || NEW.titre || ' » est marqué comme publié. Une fiche de stock interne a été préparée.',
      '/stocks',
      jsonb_build_object('manuscrit_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_manuscrit_publie ON public.manuscrits;
CREATE TRIGGER trg_manuscrit_publie
AFTER INSERT OR UPDATE OF statut ON public.manuscrits
FOR EACH ROW EXECUTE FUNCTION public.trg_manuscrit_publie();

-- ============================================================
-- 5. TRIGGER: vente créée → notifie
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_vente_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_titre text;
BEGIN
  SELECT titre INTO v_titre FROM public.manuscrits WHERE id = NEW.manuscrit_id;
  PERFORM public.fn_notify(
    NEW.entreprise_id, 'vente',
    '✅ Vente enregistrée',
    NEW.quantite_vendue || ' exemplaire(s) de « ' || COALESCE(v_titre,'livre') || ' » — ' ||
    to_char(NEW.montant_total_fcfa, 'FM999G999G999') || ' FCFA',
    '/finances',
    jsonb_build_object('vente_id', NEW.id, 'manuscrit_id', NEW.manuscrit_id)
  );
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_vente_inserted ON public.ventes;
CREATE TRIGGER trg_vente_inserted
AFTER INSERT ON public.ventes
FOR EACH ROW EXECUTE FUNCTION public.trg_vente_inserted();

-- ============================================================
-- 6. TRIGGER: royalties payés → notifie
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_vente_paye()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_auteur text;
BEGIN
  IF NEW.statut_paiement = 'paye' AND OLD.statut_paiement IS DISTINCT FROM 'paye' THEN
    SELECT nom_complet INTO v_auteur FROM public.auteurs WHERE id = NEW.auteur_id;
    PERFORM public.fn_notify(
      NEW.entreprise_id, 'royalty_paye',
      '💰 Droits d''auteur payés',
      COALESCE(v_auteur, 'Auteur') || ' — ' ||
      to_char(NEW.droits_auteur_fcfa, 'FM999G999G999') || ' FCFA',
      '/auteurs',
      jsonb_build_object('vente_id', NEW.id, 'auteur_id', NEW.auteur_id)
    );
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_vente_paye ON public.ventes;
CREATE TRIGGER trg_vente_paye
AFTER UPDATE OF statut_paiement ON public.ventes
FOR EACH ROW EXECUTE FUNCTION public.trg_vente_paye();

-- ============================================================
-- 7. TRIGGER: stock interne bas → notifie (1 fois par franchissement)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_stock_interne_bas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_titre text;
BEGIN
  IF NEW.quantite_disponible <= NEW.seuil_alerte
     AND (OLD.quantite_disponible IS NULL OR OLD.quantite_disponible > NEW.seuil_alerte) THEN
    SELECT titre INTO v_titre FROM public.manuscrits WHERE id = NEW.manuscrit_id;
    PERFORM public.fn_notify(
      NEW.entreprise_id, 'stock_bas',
      '⚠️ Stock bas',
      'Il reste ' || NEW.quantite_disponible || ' exemplaire(s) de « ' || COALESCE(v_titre,'livre') || ' »',
      '/stocks',
      jsonb_build_object('manuscrit_id', NEW.manuscrit_id, 'stock_interne_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_stock_interne_bas ON public.stock_interne;
CREATE TRIGGER trg_stock_interne_bas
AFTER UPDATE OF quantite_disponible ON public.stock_interne
FOR EACH ROW EXECUTE FUNCTION public.trg_stock_interne_bas();

-- ============================================================
-- 8. TRIGGER: nouveau manuscrit → notifie
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_manuscrit_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn_notify(
    NEW.entreprise_id, 'manuscrit_ajoute',
    '📚 Nouveau manuscrit',
    '« ' || NEW.titre || ' » a été ajouté à votre catalogue.',
    '/manuscrits',
    jsonb_build_object('manuscrit_id', NEW.id)
  );
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_manuscrit_inserted ON public.manuscrits;
CREATE TRIGGER trg_manuscrit_inserted
AFTER INSERT ON public.manuscrits
FOR EACH ROW EXECUTE FUNCTION public.trg_manuscrit_inserted();
