import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createJob, getJob, exportedFileFor, type CCFormat } from "./cloudconvert.server";

const metaSchema = z.object({
  titre: z.string().trim().min(1).max(200),
  auteur: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  isbn: z.string().trim().max(40).optional().nullable(),
  langue: z.string().trim().max(40).optional().nullable(),
  editeur: z.string().trim().max(200).optional().nullable(),
  annee_publication: z.number().int().min(1900).max(2100).optional().nullable(),
});

async function getEntrepriseId(supabase: ReturnType<typeof supabaseAdmin.from> extends never ? never : any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("entreprise_id")
    .eq("id", userId)
    .single();
  if (error || !data?.entreprise_id) throw new Error("Entreprise introuvable");
  return data.entreprise_id as string;
}

/** Create signed upload URL so the browser can PUT the source file directly. */
export const getSourceUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { extension: string }) =>
    z.object({ extension: z.enum(["pdf", "docx", "txt"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const entId = await getEntrepriseId(context.supabase, context.userId);
    const path = `${entId}/sources/${crypto.randomUUID()}.${data.extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("conversions")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Upload URL error");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Create a conversion row and launch the CloudConvert job immediately. */
export const createAndStartConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        manuscrit_id: z.string().uuid().optional().nullable(),
        format_source: z.enum(["pdf", "docx", "txt"]),
        fichier_source_path: z.string().min(1),
        taille_source_kb: z.number().nonnegative(),
        formats_cibles: z.array(z.enum(["epub", "mobi"])).min(1),
        couverture_path: z.string().optional().nullable(),
        metadata: metaSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const entId = await getEntrepriseId(context.supabase, context.userId);

    // Sign source URL for CloudConvert (1h)
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("conversions")
      .createSignedUrl(data.fichier_source_path, 3600);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Signed URL error");

    // Insert row
    const { data: row, error: insErr } = await supabaseAdmin
      .from("conversions")
      .insert({
        entreprise_id: entId,
        manuscrit_id: data.manuscrit_id ?? null,
        created_by: context.userId,
        format_source: data.format_source,
        fichier_source_path: data.fichier_source_path,
        taille_source_kb: data.taille_source_kb,
        formats_cibles: data.formats_cibles,
        couverture_path: data.couverture_path ?? null,
        titre: data.metadata.titre,
        auteur: data.metadata.auteur,
        description: data.metadata.description ?? null,
        isbn: data.metadata.isbn ?? null,
        langue: data.metadata.langue ?? "français",
        editeur: data.metadata.editeur ?? null,
        annee_publication: data.metadata.annee_publication ?? null,
        statut: "en_attente",
      })
      .select()
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Insert error");

    // Launch job
    try {
      const job = await createJob({
        sourceUrl: signed.signedUrl,
        sourceFormat: data.format_source,
        targets: data.formats_cibles as CCFormat[],
        metadata: { titre: data.metadata.titre, auteur: data.metadata.auteur },
      });
      await supabaseAdmin
        .from("conversions")
        .update({ statut: "en_cours", cloudconvert_job_id: job.id })
        .eq("id", row.id);
      return { id: row.id, jobId: job.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("conversions")
        .update({ statut: "echec", erreur_message: msg })
        .eq("id", row.id);
      throw new Error(msg);
    }
  });

/** Poll the CloudConvert job; if finished, fetch outputs and persist. */
export const pollConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const entId = await getEntrepriseId(context.supabase, context.userId);

    const { data: row, error } = await supabaseAdmin
      .from("conversions")
      .select("*")
      .eq("id", data.id)
      .eq("entreprise_id", entId)
      .single();
    if (error || !row) throw new Error("Conversion introuvable");

    if (row.statut === "termine" || row.statut === "echec") return row;
    if (!row.cloudconvert_job_id) return row;

    let job;
    try {
      job = await getJob(row.cloudconvert_job_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("conversions")
        .update({ statut: "echec", erreur_message: msg })
        .eq("id", row.id);
      return { ...row, statut: "echec", erreur_message: msg };
    }

    if (job.status === "error") {
      const failed = job.tasks.find((t) => t.status === "error");
      const msg = failed?.message ?? "Conversion échouée";
      await supabaseAdmin
        .from("conversions")
        .update({ statut: "echec", erreur_message: msg })
        .eq("id", row.id);
      return { ...row, statut: "echec", erreur_message: msg };
    }

    if (job.status !== "finished") return row;

    // Download exports & upload to our bucket
    let epub_path: string | null = null;
    let mobi_path: string | null = null;
    let taille_epub_kb: number | null = null;
    let taille_mobi_kb: number | null = null;

    for (const fmt of row.formats_cibles as CCFormat[]) {
      const f = exportedFileFor(job, fmt);
      if (!f) continue;
      const dl = await fetch(f.url);
      if (!dl.ok) throw new Error(`Téléchargement ${fmt} échoué`);
      const buf = new Uint8Array(await dl.arrayBuffer());
      const destPath = `${entId}/${row.id}/${f.filename}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("conversions")
        .upload(destPath, buf, {
          contentType: fmt === "epub" ? "application/epub+zip" : "application/x-mobipocket-ebook",
          upsert: true,
        });
      if (upErr) throw new Error(upErr.message);
      if (fmt === "epub") {
        epub_path = destPath;
        taille_epub_kb = Math.round(buf.byteLength / 1024);
      } else {
        mobi_path = destPath;
        taille_mobi_kb = Math.round(buf.byteLength / 1024);
      }
    }

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("conversions")
      .update({
        statut: "termine",
        completed_at: new Date().toISOString(),
        duree_conversion_secondes: Math.max(
          1,
          Math.round((Date.now() - new Date(row.created_at as string).getTime()) / 1000),
        ),
        epub_path,
        mobi_path,
        taille_epub_kb,
        taille_mobi_kb,
      })
      .eq("id", row.id)
      .select()
      .single();
    if (uErr) throw new Error(uErr.message);
    return updated;

  });

export const listConversions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const entId = await getEntrepriseId(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("conversions")
      .select("*")
      .eq("entreprise_id", entId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getConversionDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const entId = await getEntrepriseId(context.supabase, context.userId);
    if (!data.path.startsWith(`${entId}/`)) throw new Error("Accès refusé");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("conversions")
      .createSignedUrl(data.path, 3600);
    if (error || !signed) throw new Error(error?.message ?? "Signed URL error");
    return { url: signed.signedUrl };
  });

export const deleteConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const entId = await getEntrepriseId(context.supabase, context.userId);
    const { data: row } = await supabaseAdmin
      .from("conversions")
      .select("*")
      .eq("id", data.id)
      .eq("entreprise_id", entId)
      .single();
    if (!row) throw new Error("Introuvable");
    const paths = [row.epub_path, row.mobi_path, row.couverture_path, row.fichier_source_path].filter(
      Boolean,
    ) as string[];
    if (paths.length) {
      await supabaseAdmin.storage.from("conversions").remove(paths);
    }
    await supabaseAdmin.from("conversions").delete().eq("id", data.id);
    return { ok: true };
  });
