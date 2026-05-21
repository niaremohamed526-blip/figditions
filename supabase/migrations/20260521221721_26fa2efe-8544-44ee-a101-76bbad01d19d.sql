
-- Entreprises: plan + user limit
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS max_utilisateurs integer NOT NULL DEFAULT 1;

-- Profiles: role
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editeur',
  statut text NOT NULL DEFAULT 'en_attente',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ent select invitations" ON public.invitations;
DROP POLICY IF EXISTS "ent insert invitations" ON public.invitations;
DROP POLICY IF EXISTS "ent update invitations" ON public.invitations;
DROP POLICY IF EXISTS "ent delete invitations" ON public.invitations;

CREATE POLICY "ent select invitations" ON public.invitations
  FOR SELECT USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert invitations" ON public.invitations
  FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update invitations" ON public.invitations
  FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete invitations" ON public.invitations
  FOR DELETE USING (entreprise_id = public.current_entreprise_id());
