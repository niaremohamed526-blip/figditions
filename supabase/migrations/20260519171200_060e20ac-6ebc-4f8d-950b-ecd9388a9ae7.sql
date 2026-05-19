
-- Enums
CREATE TYPE public.manuscrit_statut AS ENUM ('recu','lecture','correction','maquette','impression','publie');
CREATE TYPE public.paiement_statut AS ENUM ('en_attente','paye','annule');

-- entreprises
CREATE TABLE public.entreprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ville TEXT NOT NULL DEFAULT 'Bamako',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  entreprise_id UUID REFERENCES public.entreprises(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's entreprise_id
CREATE OR REPLACE FUNCTION public.current_entreprise_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()
$$;

-- manuscrits
CREATE TABLE public.manuscrits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  auteur TEXT NOT NULL,
  genre TEXT,
  langue TEXT DEFAULT 'Français',
  statut public.manuscrit_statut NOT NULL DEFAULT 'recu',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.manuscrits ENABLE ROW LEVEL SECURITY;

-- stocks
CREATE TABLE public.stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscrit_id UUID NOT NULL REFERENCES public.manuscrits(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  exemplaires_total INTEGER NOT NULL DEFAULT 0,
  exemplaires_restants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

-- ventes
CREATE TABLE public.ventes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscrit_id UUID NOT NULL REFERENCES public.manuscrits(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  montant NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut_paiement public.paiement_statut NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- entreprises: owner only
CREATE POLICY "owner select entreprises" ON public.entreprises FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "owner insert entreprises" ON public.entreprises FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update entreprises" ON public.entreprises FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "owner delete entreprises" ON public.entreprises FOR DELETE USING (owner_id = auth.uid());

-- profiles: self
CREATE POLICY "self select profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "self insert profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- manuscrits / stocks / ventes: scoped to user's entreprise
CREATE POLICY "ent select manuscrits" ON public.manuscrits FOR SELECT USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert manuscrits" ON public.manuscrits FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update manuscrits" ON public.manuscrits FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete manuscrits" ON public.manuscrits FOR DELETE USING (entreprise_id = public.current_entreprise_id());

CREATE POLICY "ent select stocks" ON public.stocks FOR SELECT USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert stocks" ON public.stocks FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update stocks" ON public.stocks FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete stocks" ON public.stocks FOR DELETE USING (entreprise_id = public.current_entreprise_id());

CREATE POLICY "ent select ventes" ON public.ventes FOR SELECT USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent insert ventes" ON public.ventes FOR INSERT WITH CHECK (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent update ventes" ON public.ventes FOR UPDATE USING (entreprise_id = public.current_entreprise_id());
CREATE POLICY "ent delete ventes" ON public.ventes FOR DELETE USING (entreprise_id = public.current_entreprise_id());

-- Trigger: on signup, create entreprise + profile from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_ent_id UUID;
  v_full_name TEXT;
  v_ent_nom TEXT;
  v_ville TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_ent_nom := COALESCE(NEW.raw_user_meta_data->>'entreprise_nom', v_full_name || ' Éditions');
  v_ville := COALESCE(NEW.raw_user_meta_data->>'ville', 'Bamako');

  INSERT INTO public.entreprises(nom, ville, owner_id)
  VALUES (v_ent_nom, v_ville, NEW.id)
  RETURNING id INTO new_ent_id;

  INSERT INTO public.profiles(id, full_name, entreprise_id)
  VALUES (NEW.id, v_full_name, new_ent_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
