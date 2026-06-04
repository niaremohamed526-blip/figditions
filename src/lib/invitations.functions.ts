import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  // never grant parametres via invitation — admin-only
  result.parametres = false;
  return result;
}

/** PUBLIC — fetch invitation by token (no auth). Returns minimal safe data. */
export const getInvitationByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("id, email, statut, expires_at, permissions, full_name, role_label, entreprise_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return { valid: false as const, reason: "invalid" as const };
    if (inv.statut !== "en_attente") return { valid: false as const, reason: "used" as const };
    if (new Date(inv.expires_at as string).getTime() < Date.now())
      return { valid: false as const, reason: "expired" as const };

    const { data: ent } = await supabaseAdmin
      .from("entreprises")
      .select("nom")
      .eq("id", inv.entreprise_id as string)
      .maybeSingle();

    return {
      valid: true as const,
      email: inv.email as string,
      full_name: (inv.full_name as string | null) ?? null,
      role_label: (inv.role_label as string | null) ?? null,
      permissions: (inv.permissions ?? {}) as Permissions,
      entreprise_nom: (ent?.nom as string | null) ?? "votre maison d'édition",
    };
  });

/** Called after sign-up/sign-in to wire invited user into the right entreprise. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const callerEmail = (context.claims.email as string | undefined)?.toLowerCase() ?? null;
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitation introuvable");
    if (inv.statut !== "en_attente") throw new Error("Invitation déjà utilisée");
    if (new Date(inv.expires_at as string).getTime() < Date.now())
      throw new Error("Invitation expirée");
    if (!callerEmail || callerEmail !== (inv.email as string).toLowerCase()) {
      throw new Error("Ce lien n'est pas valide pour votre adresse email");
    }

    const perms = sanitizePermissions(inv.permissions);

    // Cleanup: handle_new_user may have auto-created an entreprise for OAuth flow.
    // Delete spurious entreprises owned by this user (other than the invited one).
    await supabaseAdmin
      .from("entreprises")
      .delete()
      .eq("owner_id", userId)
      .neq("id", inv.entreprise_id as string);

    // Wire profile to the invited entreprise with the granted permissions.
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        entreprise_id: inv.entreprise_id as string,
        role: "membre",
        permissions: perms,
        role_label: (inv.role_label as string | null) ?? null,
        full_name: (inv.full_name as string | null) ?? undefined,
      })
      .eq("id", userId);
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin
      .from("invitations")
      .update({ statut: "acceptee" })
      .eq("id", inv.id);

    return { ok: true, entreprise_id: inv.entreprise_id as string };
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
    // Must be admin
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("role, entreprise_id")
      .eq("id", context.userId)
      .single();
    if (!me || me.role !== "admin" || !me.entreprise_id) {
      throw new Error("Action réservée à l'administrateur");
    }
    const perms = sanitizePermissions(data.permissions);

    const { data: row, error } = await supabaseAdmin
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
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("role, entreprise_id")
      .eq("id", context.userId)
      .single();
    if (!me || me.role !== "admin") throw new Error("Action réservée à l'administrateur");
    const perms = sanitizePermissions(data.permissions);
    const { error } = await supabaseAdmin
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
    const { data: me } = await supabaseAdmin
      .from("profiles").select("role, entreprise_id").eq("id", context.userId).single();
    if (!me || me.role !== "admin") throw new Error("Action réservée à l'administrateur");
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
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
    const { data: me } = await supabaseAdmin
      .from("profiles").select("role, entreprise_id").eq("id", context.userId).single();
    if (!me || me.role !== "admin" || !me.entreprise_id) {
      throw new Error("Action réservée à l'administrateur");
    }
    if (data.member_id === context.userId) {
      throw new Error("Vous ne pouvez pas modifier vos propres permissions");
    }
    const perms = sanitizePermissions(data.permissions);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ permissions: perms, role_label: data.role_label ?? null })
      .eq("id", data.member_id)
      .eq("entreprise_id", me.entreprise_id as string);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: string }) => z.object({ member_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: me } = await supabaseAdmin
      .from("profiles").select("role, entreprise_id").eq("id", context.userId).single();
    if (!me || me.role !== "admin") throw new Error("Action réservée à l'administrateur");
    if (data.member_id === context.userId) throw new Error("Action impossible");
    // Delete profile (RLS will allow this for admin); also unset auth user via admin API
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", data.member_id)
      .eq("entreprise_id", me.entreprise_id as string);
    try {
      await supabaseAdmin.auth.admin.deleteUser(data.member_id);
    } catch {
      // ignore — profile delete is the source of truth for app access
    }
    return { ok: true };
  });
