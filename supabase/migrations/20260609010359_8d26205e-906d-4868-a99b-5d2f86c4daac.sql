CREATE OR REPLACE FUNCTION public.pdf_partages_check_manuscrit_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_ent uuid;
BEGIN
  SELECT entreprise_id INTO m_ent FROM public.manuscrits WHERE id = NEW.manuscrit_id;
  IF m_ent IS NULL THEN
    RAISE EXCEPTION 'manuscrit introuvable';
  END IF;
  IF m_ent <> NEW.entreprise_id THEN
    RAISE EXCEPTION 'manuscrit_id does not belong to entreprise_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pdf_partages_check_manuscrit_tenant_trg ON public.pdf_partages;
CREATE TRIGGER pdf_partages_check_manuscrit_tenant_trg
BEFORE INSERT OR UPDATE OF manuscrit_id, entreprise_id ON public.pdf_partages
FOR EACH ROW EXECUTE FUNCTION public.pdf_partages_check_manuscrit_tenant();