-- One row per question asked to Pr. MEDMO (chat or sales-notebook photo).
-- Used for the monthly quota of each plan (Starter 20, Pro 300, Business
-- unlimited). Chat messages can't be counted for this: the thread is rewritten
-- on every answer, which resets their created_at.
CREATE TABLE IF NOT EXISTS public.medmo_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'photo_ventes')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medmo_usage_entreprise_mois_idx
  ON public.medmo_usage (entreprise_id, created_at);

ALTER TABLE public.medmo_usage ENABLE ROW LEVEL SECURITY;

-- Members can see their house's usage and record their own questions.
-- No update/delete policy: usage can't be erased to reset the quota.
DROP POLICY IF EXISTS "ent select medmo_usage" ON public.medmo_usage;
CREATE POLICY "ent select medmo_usage" ON public.medmo_usage FOR SELECT TO authenticated
  USING (entreprise_id = private.current_entreprise_id());
DROP POLICY IF EXISTS "ent insert medmo_usage" ON public.medmo_usage;
CREATE POLICY "ent insert medmo_usage" ON public.medmo_usage FOR INSERT TO authenticated
  WITH CHECK (entreprise_id = private.current_entreprise_id() AND user_id = auth.uid());
