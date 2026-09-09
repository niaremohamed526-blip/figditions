CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre text NOT NULL,
  hook text NOT NULL,
  version text,
  date_publication timestamptz NOT NULL DEFAULT now(),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.changelog_entries TO authenticated;
GRANT ALL ON public.changelog_entries TO service_role;
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog_entries_authenticated_read"
  ON public.changelog_entries FOR SELECT TO authenticated
  USING (actif = true);

CREATE TABLE IF NOT EXISTS public.changelog_vu_par (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  changelog_id uuid NOT NULL REFERENCES public.changelog_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vu_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (changelog_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.changelog_vu_par TO authenticated;
GRANT ALL ON public.changelog_vu_par TO service_role;
ALTER TABLE public.changelog_vu_par ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog_vu_par_own_select"
  ON public.changelog_vu_par FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "changelog_vu_par_own_insert"
  ON public.changelog_vu_par FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "changelog_vu_par_own_delete"
  ON public.changelog_vu_par FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_changelog_vu_par_user ON public.changelog_vu_par (user_id);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_date ON public.changelog_entries (date_publication DESC);