import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Permissions } from "@/lib/permissions";
import { fullPermissions } from "@/lib/permissions";

export type AppRole = "admin" | "editeur" | "comptable" | "commercial" | "membre";
export type AppPlan = "starter" | "pro" | "business";

export interface Profile {
  id: string;
  full_name: string;
  entreprise_id: string | null;
  role: AppRole;
  permissions: Permissions;
  role_label?: string | null;
}
export interface Entreprise {
  id: string;
  nom: string;
  ville: string;
  plan: AppPlan;
  max_utilisateurs: number;
  owner_id: string;
  logo_url?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
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

export function notifyEntrepriseUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("entreprise:updated"));
  }
}
export function notifyProfileUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("profile:updated"));
  }
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    // A failed or empty read (slow network, token being refreshed) must not
    // look like "no permissions": retry, and keep the profile we already have.
    let p: unknown = null;
    let failed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      p = data;
      failed = !!error;
      if (data) break;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    if (failed && !p) {
      setLoading(false);
      setLoadedFor(userId);
      return;
    }
    const raw = p as (Profile & { permissions: unknown }) | null;
    const normalized: Profile | null = raw
      ? {
          ...raw,
          permissions:
            (raw.permissions && typeof raw.permissions === "object"
              ? (raw.permissions as Permissions)
              : raw.role === "admin"
              ? fullPermissions()
              : {}),
        }
      : null;
    setProfile(normalized);
    if (raw?.entreprise_id) {
      const { data: e } = await supabase.from("entreprises").select("*").eq("id", raw.entreprise_id).maybeSingle();
      setEntreprise(e as Entreprise | null);
    }
    setLoading(false);
    setLoadedFor(userId);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => load();
    window.addEventListener("entreprise:updated", handler);
    window.addEventListener("profile:updated", handler);
    return () => {
      window.removeEventListener("entreprise:updated", handler);
      window.removeEventListener("profile:updated", handler);
    };
  }, [load]);

  // Realtime: own profile updates (permissions changed by admin) and own entreprise updates
  useEffect(() => {
    if (!userId) return;
    const uniq = Math.random().toString(36).slice(2, 10);
    const ch = supabase
      .channel(`profile-${userId}-${uniq}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  // Not done until THIS user's profile has loaded: on first render userId is
  // still undefined, which used to report "done" early and flash AccessDenied.
  return { profile, entreprise, loading: userId ? loadedFor !== userId : loading, refresh: load };
}
