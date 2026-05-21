import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editeur" | "comptable" | "commercial";
export type AppPlan = "starter" | "pro" | "business";

export interface Profile {
  id: string;
  full_name: string;
  entreprise_id: string | null;
  role: AppRole;
}
export interface Entreprise {
  id: string;
  nom: string;
  ville: string;
  plan: AppPlan;
  max_utilisateurs: number;
  owner_id: string;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (!active) return;
      setProfile(p as Profile | null);
      if (p?.entreprise_id) {
        const { data: e } = await supabase.from("entreprises").select("*").eq("id", p.entreprise_id).maybeSingle();
        if (!active) return;
        setEntreprise(e as Entreprise | null);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  return { profile, entreprise, loading };
}
