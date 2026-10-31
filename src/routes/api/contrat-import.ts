import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateText, Output } from "ai";
import { inflateRawSync } from "node:zlib";
import { z } from "zod";
import { createGeminiProvider, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { CHAMPS, TYPES_CONTRAT } from "@/lib/contrat-template";

// Medmo turns a house's own contract (PDF, photo or Word) into a template:
// its articles, with the party-specific values replaced by {champs}.
// Same bearer auth as /api/chat. Nothing is saved here: the house reviews
// the result in the template editor and saves it itself.

type AnySupabase = SupabaseClient<any, "public", any>;

const LOVABLE_MODEL_ID = "google/gemini-3-flash";
const GEMINI_MODEL_ID = "gemini-3.8-flash";
// Vercel refuses request bodies over 4.5 MB; base64 adds a third.
const MAX_BYTES = 3.2 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const NATIVE = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function userClient(token: string): AnySupabase {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Paragraph text of a .docx (word/document.xml), read from the zip's central directory. */
function docxText(buf: Buffer): string {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Fichier Word illisible.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen).replace(/\\/g, "/");
    if (name === "word/document.xml") {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const raw = buf.subarray(start, start + size);
      const xml = (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
      return xml
        .split(/<\/w:p>/)
        .map((para) => [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => m[1] ?? "\t").join(""))
        .map((s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim())
        .filter(Boolean)
        .join("\n");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("Ce fichier Word ne contient pas de texte lisible.");
}

const schema = z.object({
  lisible: z.boolean().describe("false si le document n'est pas un contrat ou est illisible"),
  titre_document: z.string().describe("Titre du contrat, ex. « Contrat d'édition »"),
  sous_titre: z.string().nullable(),
  type_contrat: z.enum(["edition", "traduction", "illustration", "coedition", "cession", "autre"]),
  articles: z.array(z.object({
    titre: z.string().describe("Titre de l'article sans « Article n »"),
    texte: z.string().describe("Texte de l'article, avec les {champs}"),
  })),
  remarques: z.array(z.string()).describe("Points à vérifier par l'éditeur, en français, courts"),
});

const CONSIGNES = `Tu es Medmo, assistant de FIGDITIONS pour les maisons d'édition.
On te donne le contrat qu'une maison d'édition utilise déjà. Transforme-le en MODÈLE réutilisable.

Règles :
1. Reprends le texte des articles MOT POUR MOT. Ne reformule pas, ne corrige pas le droit, n'invente aucun article, ne supprime aucune clause.
2. Remplace uniquement les valeurs propres à un contrat précis par des champs entre accolades, choisis dans cette liste et nulle part ailleurs :
${CHAMPS.map((c) => `   {${c.cle}} : ${c.label}`).join("\n")}
   Exemples : le nom de l'auteur → {auteur} (ou {auteur_maj} s'il est en majuscules), le nom de la maison → {maison}, les titres des livres → {livres}, « 10 % » des droits → {pourcentage} %, « 10 ans » → {duree_annees} ans, la date de signature → {date_signature}.
   Une valeur qui ne correspond à aucun champ reste écrite telle quelle.
3. Une phrase qui n'a de sens que si un champ est rempli s'écrit [[cle: phrase avec {cle}]] (ex. la contribution financière de l'auteur).
4. N'inclus PAS : l'en-tête avec les coordonnées des parties (« Entre les soussignés… »), la liste des ouvrages, « Fait à … le … », les signatures, les paraphes. FIGDITIONS les génère.
5. Un article = un titre court + son texte. Retire la numérotation (« Article 3 : », « 3. ») du titre. Garde les paragraphes avec des retours à la ligne.
6. Dans remarques, signale en français ce que l'éditeur doit vérifier (valeur non reconnue, passage illisible, clause qui semble incomplète). Maximum 5 remarques.
7. Si le document n'est pas un contrat ou est illisible, mets lisible à false et articles vide.`;

export const Route = createFileRoute("/api/contrat-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ erreur: "Non authentifié" }, { status: 401 });
        }
        const token = authHeader.slice(7);
        const supabase = userClient(token);
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          return Response.json({ erreur: "Session invalide" }, { status: 401 });
        }

        const geminiKey = process.env["GEMINI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];
        if (!geminiKey && !lovableKey) {
          return Response.json({ erreur: "Le service IA n'est pas configuré (GEMINI_API_KEY manquante)." }, { status: 500 });
        }

        const body = (await request.json().catch(() => ({}))) as { nom_fichier?: string; media_type?: string; data?: string };
        const mediaType = String(body.media_type ?? "");
        const nom = String(body.nom_fichier ?? "contrat").slice(0, 120);
        if (!body.data) return Response.json({ erreur: "Aucun fichier reçu." }, { status: 400 });
        const buf = Buffer.from(body.data, "base64");
        if (buf.length > MAX_BYTES) return Response.json({ erreur: "Fichier trop lourd (3 Mo maximum)." }, { status: 413 });

        let contenu: any[];
        try {
          if (mediaType === DOCX || /\.docx$/i.test(nom)) {
            const texte = docxText(buf);
            if (texte.length < 200) return Response.json({ erreur: "Le document Word semble vide." }, { status: 422 });
            contenu = [{ type: "text", text: `Contrat (fichier Word « ${nom} ») :\n\n${texte.slice(0, 60000)}` }];
          } else if (NATIVE.includes(mediaType)) {
            contenu = [
              { type: "text", text: `Contrat (fichier « ${nom} ») :` },
              { type: "file", data: buf, mediaType },
            ];
          } else {
            return Response.json({ erreur: "Format non pris en charge. Envoyez un PDF, un Word (.docx) ou une photo (JPG, PNG)." }, { status: 415 });
          }
        } catch (e: any) {
          return Response.json({ erreur: e?.message ?? "Fichier illisible." }, { status: 422 });
        }

        const gateway = geminiKey ? createGeminiProvider(geminiKey) : createLovableAiGatewayProvider(lovableKey!);
        const modelId = geminiKey ? GEMINI_MODEL_ID : LOVABLE_MODEL_ID;
        try {
          const { output } = await generateText({
            model: gateway(modelId) as any,
            system: CONSIGNES,
            messages: [{ role: "user", content: contenu }],
            output: Output.object({ schema }),
            maxRetries: 1,
          });
          if (!output.lisible || output.articles.length === 0) {
            return Response.json({ erreur: "Medmo n'a pas reconnu de contrat dans ce document. Essayez un fichier plus net ou au format Word." }, { status: 422 });
          }
          const type = TYPES_CONTRAT.some((t) => t.value === output.type_contrat) ? output.type_contrat : "autre";
          return Response.json({
            modele: {
              nom: nom.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Mon contrat",
              type_contrat: type,
              titre_document: output.titre_document.trim() || "Contrat",
              sous_titre: output.sous_titre?.trim() || null,
              articles: output.articles
                .map((a) => ({ titre: a.titre.trim(), texte: a.texte.trim() }))
                .filter((a) => a.titre || a.texte)
                .slice(0, 60),
            },
            remarques: output.remarques.slice(0, 5),
          });
        } catch (e: any) {
          const msg = String(e?.message ?? "");
          if (/api key|401|403|permission/i.test(msg)) {
            return Response.json({ erreur: "La clé du service IA est invalide ou expirée." }, { status: 502 });
          }
          return Response.json({ erreur: "Medmo n'a pas pu lire ce contrat. Réessayez dans un instant." }, { status: 502 });
        }
      },
    },
  },
});
