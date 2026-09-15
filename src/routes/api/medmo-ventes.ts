import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Photo-to-Action : enregistrement en masse des ventes validées dans la carte
// PR MEDMO. Même auth bearer que /api/chat : RLS appliquée en tant que
// l'utilisateur connecté. Aucune clé service requise (compatible Vercel).

type AnySupabase = SupabaseClient<any, "public", any>;

const num = (v: unknown) => Number(v ?? 0);
const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} FCFA`;

function userClient(token: string): AnySupabase {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

interface EntreeValidee {
  manuscrit_id: string;
  titre?: string | null;
  librairie?: string | null;
  quantite: number;
  prix_unitaire_fcfa: number;
  date?: string | null;
  statut_paiement?: "paye" | "en_attente" | null;
  // Traçabilité / apprentissage :
  extrait_titre?: string | null;
  extrait_librairie?: string | null;
  corrige_titre?: boolean;
  corrige_librairie?: boolean;
}

export const Route = createFileRoute("/api/medmo-ventes")({
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
        const userId = claimsData.claims.sub as string;

        const body = (await request.json()) as { entrees?: EntreeValidee[] };
        const entrees = Array.isArray(body.entrees) ? body.entrees.slice(0, 60) : [];
        if (entrees.length === 0) {
          return Response.json({ erreur: "Aucune vente à enregistrer." }, { status: 400 });
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("entreprise_id")
          .eq("id", userId)
          .maybeSingle();
        const eid = profile?.entreprise_id as string | null;
        if (!eid) {
          return Response.json({ erreur: "Aucune maison d'édition associée à ce compte." }, { status: 403 });
        }

        const today = new Date().toISOString().slice(0, 10);
        const resultats: { index: number; ok: boolean; message: string }[] = [];
        const corrections: Record<string, unknown>[] = [];

        for (const [index, e] of entrees.entries()) {
          const quantite = Math.round(num(e.quantite));
          const prix = Math.round(num(e.prix_unitaire_fcfa));
          const titreAff = e.titre ?? "ce livre";
          if (!e.manuscrit_id || quantite <= 0 || prix <= 0) {
            resultats.push({ index, ok: false, message: `« ${titreAff} » : livre, quantité ou prix manquant : ligne ignorée.` });
            continue;
          }

          // Vérifie que le manuscrit appartient bien à la maison d'édition.
          const { data: m } = await supabase
            .from("manuscrits")
            .select("id, titre")
            .eq("id", e.manuscrit_id)
            .eq("entreprise_id", eid)
            .maybeSingle();
          if (!m) {
            resultats.push({ index, ok: false, message: `« ${titreAff} » : livre introuvable dans votre catalogue.` });
            continue;
          }

          const notesBase = `Saisie via photo de cahier (PR MEDMO)${e.statut_paiement === "en_attente" ? " : paiement à encaisser" : ""}`;
          const librairie = e.librairie?.trim() || null;

          if (librairie) {
            // --- Vente en librairie : mise à jour du dépôt (le trigger crée la vente) ---
            const { data: rows } = await supabase
              .from("stocks")
              .select("id, librairie_nom, exemplaires_restants, exemplaires_vendus, prix_unitaire_fcfa")
              .eq("entreprise_id", eid)
              .eq("manuscrit_id", m.id)
              .ilike("librairie_nom", `%${librairie}%`)
              .limit(3);
            const depots = rows ?? [];
            if (depots.length === 0) {
              resultats.push({ index, ok: false, message: `« ${m.titre} » : aucun dépôt trouvé chez « ${librairie} ». Créez d'abord le dépôt (PR MEDMO peut le faire).` });
              continue;
            }
            if (depots.length > 1) {
              resultats.push({ index, ok: false, message: `« ${m.titre} » : plusieurs dépôts correspondent à « ${librairie} » (${depots.map((d) => d.librairie_nom).join(", ")}). Précisez le nom.` });
              continue;
            }
            const s = depots[0];
            if (num(s.exemplaires_restants) < quantite) {
              resultats.push({ index, ok: false, message: `« ${m.titre} » chez ${s.librairie_nom} : seulement ${num(s.exemplaires_restants)} exemplaire(s) restant(s) pour ${quantite} vendu(s).` });
              continue;
            }
            const { error } = await supabase
              .from("stocks")
              .update({
                prix_unitaire_fcfa: prix,
                exemplaires_vendus: num(s.exemplaires_vendus) + quantite,
                exemplaires_restants: Math.max(0, num(s.exemplaires_restants) - quantite),
              })
              .eq("id", s.id);
            if (error) {
              resultats.push({ index, ok: false, message: `« ${m.titre} » : ${error.message}` });
              continue;
            }
            resultats.push({
              index,
              ok: true,
              message: `${quantite} × « ${m.titre} » chez ${s.librairie_nom} = ${fcfa(quantite * prix)}. Reste sur place : ${Math.max(0, num(s.exemplaires_restants) - quantite)}.`,
            });
          } else {
            // --- Vente directe : RPC atomique (mouvement + vente + droits) ---
            const { data: stock } = await supabase
              .from("stock_interne")
              .select("id, quantite_disponible")
              .eq("entreprise_id", eid)
              .eq("manuscrit_id", m.id)
              .maybeSingle();
            if (!stock) {
              resultats.push({ index, ok: false, message: `« ${m.titre} » : pas de stock interne. Créez d'abord une impression.` });
              continue;
            }
            if (num(stock.quantite_disponible) < quantite) {
              resultats.push({ index, ok: false, message: `« ${m.titre} » : stock interne insuffisant (${num(stock.quantite_disponible)} dispo pour ${quantite} vendu(s)).` });
              continue;
            }
            const { error } = await supabase.rpc("record_stock_mouvement", {
              p_manuscrit_id: m.id,
              p_type: "vente_directe",
              p_quantite: quantite,
              p_notes: notesBase,
              p_date: e.date ?? today,
              p_prix_unitaire: prix,
              p_prix_catalogue: null,
            });
            if (error) {
              resultats.push({ index, ok: false, message: `« ${m.titre} » : ${error.message}` });
              continue;
            }
            resultats.push({
              index,
              ok: true,
              message: `Vente directe : ${quantite} × « ${m.titre} » = ${fcfa(quantite * prix)}. Stock restant : ${num(stock.quantite_disponible) - quantite}.`,
            });
          }

          // --- Apprentissage : mémorise les corrections de l'utilisateur ---
          if (e.corrige_titre && e.extrait_titre && e.extrait_titre.trim().toLowerCase() !== m.titre.trim().toLowerCase()) {
            corrections.push({
              entreprise_id: eid,
              user_id: userId,
              type_correction: "titre_livre",
              texte_extrait: e.extrait_titre.trim(),
              valeur_correcte: m.titre,
            });
          }
          if (e.corrige_librairie && e.extrait_librairie && librairie && e.extrait_librairie.trim().toLowerCase() !== librairie.toLowerCase()) {
            corrections.push({
              entreprise_id: eid,
              user_id: userId,
              type_correction: "librairie",
              texte_extrait: e.extrait_librairie.trim(),
              valeur_correcte: librairie,
            });
          }
        }

        if (corrections.length > 0) {
          try {
            await supabase.from("medmo_ocr_corrections").insert(corrections as any);
          } catch {
            /* apprentissage best-effort */
          }
        }

        const okCount = resultats.filter((r) => r.ok).length;
        return Response.json({
          succes: okCount,
          echecs: resultats.length - okCount,
          corrections_apprises: corrections.length,
          resultats,
        });
      },
    },
  },
});
