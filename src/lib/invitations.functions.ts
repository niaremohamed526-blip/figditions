import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAGES, type Permissions } from "./permissions";

const permissionsSchema = z.record(z.string(), z.boolean());

function sanitizePermissions(input: unknown): Permissions {
  const valid = new Set(PAGES.map((p) => p.key));
  const result: Permissions = { dashboard: true };
  if (input && typeof input === "object") {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (valid.has(k as never) && typeof v === "boolean") {
        (result as Record<string, boolean>)[k] = v;
      }
    }
  }
  result.parametres = false;
  return result;
}

/** PUBLIC — fetch invitation by token via SECURITY DEFINER RPC (no service-role needed). */
export const getInvitationByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rpc, error } = await sb.rpc("get_invitation_public", { p_token: data.token });
    if (error || !rpc) return { valid: false as const, reason: "invalid" as const };
    const r = rpc as {
      valid: boolean;
      reason?: "invalid" | "used" | "expired";
      email?: string;
      full_name?: string | null;
      role_label?: string | null;
      permissions?: Permissions;
      entreprise_nom?: string;
    };
    if (!r.valid) return { valid: false as const, reason: (r.reason ?? "invalid") };
    return {
      valid: true as const,
      email: r.email!,
      full_name: r.full_name ?? null,
      role_label: r.role_label ?? null,
      permissions: (r.permissions ?? {}) as Permissions,
      entreprise_nom: r.entreprise_nom ?? "votre maison d'édition",
    };
  });

/** Called after sign-up/sign-in — uses SECURITY DEFINER RPC. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rpc, error } = await context.supabase.rpc("accept_invitation", {
      p_token: data.token,
    });
    if (error) throw new Error(error.message);
    const r = rpc as { ok: boolean; error?: string; entreprise_id?: string };
    if (!r.ok) throw new Error(r.error ?? "Erreur d'acceptation");
    return { ok: true, entreprise_id: r.entreprise_id! };
  });

/** Create an invitation (admin only). */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email().trim().max(255),
        full_name: z.string().trim().max(200).optional().nullable(),
        role_label: z.string().trim().max(120).optional().nullable(),
        permissions: permissionsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("role, entreprise_id")
      .eq("id", context.userId)
      .single();
    if (!me || me.role !== "admin" || !me.entreprise_id) {
      throw new Error("Action réservée à l'administrateur");
    }
    const perms = sanitizePermissions(data.permissions);

    const { data: row, error } = await context.supabase
      .from("invitations")
      .insert({
        entreprise_id: me.entreprise_id as string,
        email: data.email,
        full_name: data.full_name ?? null,
        role_label: data.role_label ?? null,
        permissions: perms,
        role: "membre",
        statut: "en_attente",
      })
      .select("token")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Erreur");
    return { token: row.token as string };
  });

export const updateInvitationPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), permissions: permissionsSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("role, entreprise_id")
      .eq("id", context.userId)
      .single();
    if (!me || me.role !== "admin") throw new Error("Action réservée à l'administrateur");
    const perms = sanitizePermissions(data.permissions);
    const { error } = await context.supabase
      .from("invitations")
      .update({ permissions: perms })
      .eq("id", data.id)
      .eq("entreprise_id", me.entreprise_id as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("role, entreprise_id").eq("id", context.userId).single();
    if (!me || me.role !== "admin") throw new Error("Action réservée à l'administrateur");
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await context.supabase
      .from("invitations")
      .update({ expires_at: newExpiry, statut: "en_attente" })
      .eq("id", data.id)
      .eq("entreprise_id", me.entreprise_id as string);
    if (error) throw new Error(error.message);
    return { ok: true, expires_at: newExpiry };
  });

export const updateMemberPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      member_id: z.string().uuid(),
      permissions: permissionsSchema,
      role_label: z.string().trim().max(120).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("role, entreprise_id").eq("id", context.userId).single();
    if (!me || me.role !== "admin" || !me.entreprise_id) {
      throw new Error("Action réservée à l'administrateur");
    }
    if (data.member_id === context.userId) {
      throw new Error("Vous ne pouvez pas modifier vos propres permissions");
    }
    const perms = sanitizePermissions(data.permissions);
    const { error } = await context.supabase
      .from("profiles")
      .update({ permissions: perms, role_label: data.role_label ?? null })
      .eq("id", data.member_id)
      .eq("entreprise_id", me.entreprise_id as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Removes a member. Auth-user deletion requires service-role and is best-effort. */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: string }) => z.object({ member_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles").select("role, entreprise_id").eq("id", context.userId).single();
    if (!me || me.role !== "admin") throw new Error("Action réservée à l'administrateur");
    if (data.member_id === context.userId) throw new Error("Action impossible");

    // Delete profile via RLS (admin policy allows this)
    const { error: delErr } = await context.supabase
      .from("profiles")
      .delete()
      .eq("id", data.member_id)
      .eq("entreprise_id", me.entreprise_id as string);
    if (delErr) throw new Error(delErr.message);

    // Best-effort auth user deletion (needs service-role; skipped silently otherwise)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.auth.admin.deleteUser(data.member_id);
      } catch {
        /* profile delete is source of truth */
      }
    }
    return { ok: true };
  });
