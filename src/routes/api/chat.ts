import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  validateUIMessages,
  TypeValidationError,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createGeminiProvider, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildMedmoSystemPrompt } from "@/lib/medmo-prompt";
import { normalizeMatchKey, normalizeName } from "@/lib/normalizeText";
import {
  besoinConfirmation,
  fetchAuteurs,
  fetchLibrairies,
  fetchLivres,
  loadCorrections,
  noteInterpretation,
  resolveAuteur,
  resolveLibrairie,
  resolveLivre,
  saveCorrection,
  type Corrections,
  type LivreRef,
} from "@/lib/medmo-resolve.server";

// On Lovable hosting the managed LOVABLE_API_KEY is injected; on external
// deployments (Vercel) the owner provides GEMINI_API_KEY from Google AI Studio.
const LOVABLE_MODEL_ID = "google/gemini-3-flash";
const GEMINI_MODEL_ID = "gemini-2.5-flash";

type AnySupabase = SupabaseClient<any, "public", any>;

const num = (v: unknown) => Number(v ?? 0);
const fcfa = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} FCFA`;

/** Server-side Supabase client authenticated as the requesting user (RLS applies). */
function userClient(token: string): AnySupabase {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Préfixe de transparence : Pr. MEDMO annonce toujours ce qu'il a compris. */
const withNote = (note: string | null | undefined, resume: string) => (note ? `${note} ${resume}` : resume);

/**
 * Rapproche un titre mentionné en conversation du catalogue réel, avec les
 * mêmes paliers de confiance que les formulaires manuels et l'import Excel.
 */
async function findManuscrit(
  supabase: AnySupabase,
  entrepriseId: string,
  livre: string,
  opts: { publiesSeulement?: boolean } = {},
): Promise<{ manuscrit: LivreRef; note: string | null } | { error: string }> {
  const [livres, corrections] = await Promise.all([
    fetchLivres(supabase, entrepriseId, false),
    loadCorrections(supabase, entrepriseId),
  ]);
  const pool = opts.publiesSeulement ? livres.filter((l) => l.statut === "publie") : livres;
  if (pool.length === 0) return { error: "Aucun manuscrit enregistré pour cette maison d'édition." };
  const res = resolveLivre(livre, pool, corrections);
  if (res.confiance === "haute" && res.match) {
    return { manuscrit: res.match, note: noteInterpretation(livre, res.match.titre, "votre livre") };
  }
  const c = besoinConfirmation(res, "titre_livre", (l) => l.titre);
  return { error: `${c.interpretation} ${c.question}` };
}

/** Rapproche une librairie mentionnée des dépôts réels d'un livre. */
function resolveDepot(
  rows: { id: string; librairie_nom: string; [k: string]: any }[],
  librairie: string,
  corrections: Corrections | null,
): { depot: (typeof rows)[number]; note: string | null } | { error: string } {
  if (rows.length === 0) return { error: `Aucun dépôt trouvé dans une librairie correspondant à « ${librairie} ».` };
  const res = resolveLibrairie(librairie, rows.map((r) => ({ nom: r.librairie_nom, adresse: null })), corrections);
  if (res.confiance === "haute" && res.match) {
    const nom = res.match.nom;
    const hits = rows.filter((r) => r.librairie_nom === nom);
    if (hits.length > 1) {
      return { error: `Plusieurs dépôts portent le nom « ${nom} » (adresses différentes). Précisez l'adresse de la librairie.` };
    }
    return { depot: hits[0]!, note: noteInterpretation(librairie, nom, "la librairie") };
  }
  const c = besoinConfirmation(res, "librairie", (l) => l.nom);
  return { error: `${c.interpretation} ${c.question}` };
}


function buildTools(supabase: AnySupabase, userId: string, entrepriseId: string | null) {
  const requireEntreprise = () => {
    if (!entrepriseId) throw new Error("Aucune maison d'édition associée à ce compte.");
    return entrepriseId;
  };

  return {
    vue_ensemble: tool({
      description: "Vue d'ensemble de la maison d'édition : manuscrits, stocks, chiffre d'affaires du mois, royalties en attente, notifications.",
      inputSchema: z.object({}),
      execute: async () => {
        const eid = requireEntreprise();
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthIso = monthStart.toISOString().slice(0, 10);
        const [ms, si, se, ventes, notifs] = await Promise.all([
          supabase.from("manuscrits").select("statut").eq("entreprise_id", eid),
          supabase.from("stock_interne").select("quantite_disponible").eq("entreprise_id", eid),
          supabase.from("stocks").select("exemplaires_restants, exemplaires_vendus").eq("entreprise_id", eid),
          supabase.from("ventes").select("montant_total_fcfa, droits_auteur_fcfa, statut_paiement").eq("entreprise_id", eid).gte("date_vente", monthIso).neq("statut_paiement", "annule"),
          supabase.from("notifications").select("id").eq("entreprise_id", eid).eq("lu", false),
        ]);
        const statuts: Record<string, number> = {};
        for (const m of ms.data ?? []) statuts[m.statut] = (statuts[m.statut] ?? 0) + 1;
        const venteRows = ventes.data ?? [];
        const ca = venteRows.reduce((a, v) => a + num(v.montant_total_fcfa), 0);
        const royaltiesMois = venteRows.reduce((a, v) => a + num(v.droits_auteur_fcfa), 0);
        return {
          manuscrits_total: (ms.data ?? []).length,
          manuscrits_par_statut: statuts,
          stock_interne_disponible: (si.data ?? []).reduce((a, s) => a + num(s.quantite_disponible), 0),
          stock_librairies_restant: (se.data ?? []).reduce((a, s) => a + num(s.exemplaires_restants), 0),
          stock_librairies_vendus: (se.data ?? []).reduce((a, s) => a + num(s.exemplaires_vendus), 0),
          ventes_mois: { nombre: venteRows.length, chiffre_affaires_fcfa: ca, royalties_fcfa: royaltiesMois },
          notifications_non_lues: (notifs.data ?? []).length,
        };
      },
    }),

    consulter_stocks: tool({
      description: "Consulte les stocks : entrepôt (stock interne) et dépôts en librairies (stock externe), avec seuils d'alerte. Filtre optionnel par titre.",
      inputSchema: z.object({ recherche: z.string().nullable().describe("Filtre sur le titre du livre (optionnel)") }),
      execute: async ({ recherche }) => {
        const eid = requireEntreprise();
        let mq = supabase.from("manuscrits").select("id, titre").eq("entreprise_id", eid);
        if (recherche) mq = mq.ilike("titre", `%${recherche}%`);
        const { data: manuscrits } = await mq.limit(60);
        const ids = (manuscrits ?? []).map((m) => m.id);
        const titres = Object.fromEntries((manuscrits ?? []).map((m) => [m.id, m.titre]));
        if (ids.length === 0) return { interne: [], librairies: [], note: "Aucun livre trouvé." };
        const [{ data: interne }, { data: externe }] = await Promise.all([
          supabase.from("stock_interne").select("manuscrit_id, quantite_disponible, quantite_vendue_directement, seuil_alerte, prix_vente_direct_fcfa").eq("entreprise_id", eid).in("manuscrit_id", ids),
          supabase.from("stocks").select("manuscrit_id, librairie_nom, exemplaires_restants, exemplaires_vendus, prix_unitaire_fcfa").eq("entreprise_id", eid).in("manuscrit_id", ids),
        ]);
        return {
          interne: (interne ?? []).map((s) => ({
            livre: titres[s.manuscrit_id] ?? "?",
            disponible: num(s.quantite_disponible),
            vendus_directement: num(s.quantite_vendue_directement),
            seuil_alerte: num(s.seuil_alerte),
            prix_vente_fcfa: num(s.prix_vente_direct_fcfa),
            alerte: num(s.quantite_disponible) <= num(s.seuil_alerte),
          })),
          librairies: (externe ?? []).map((s) => ({
            livre: titres[s.manuscrit_id] ?? "?",
            librairie: s.librairie_nom,
            restants: num(s.exemplaires_restants),
            vendus: num(s.exemplaires_vendus),
            prix_fcfa: num(s.prix_unitaire_fcfa),
          })),
        };
      },
    }),

    consulter_ventes: tool({
      description: "Consulte les ventes sur une période : chiffre d'affaires, nombre de ventes, répartition par canal, meilleurs livres, paiements en attente.",
      inputSchema: z.object({ periode_jours: z.number().nullable().describe("Nombre de jours à analyser (défaut 30)") }),
      execute: async ({ periode_jours }) => {
        const eid = requireEntreprise();
        const days = periode_jours && periode_jours > 0 ? Math.min(periode_jours, 365) : 30;
        const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        const [{ data: ventes }, { data: manuscrits }] = await Promise.all([
          supabase.from("ventes").select("manuscrit_id, quantite_vendue, montant_total_fcfa, droits_auteur_fcfa, canal_vente, statut_paiement, remise_fcfa").eq("entreprise_id", eid).gte("date_vente", since).neq("statut_paiement", "annule"),
          supabase.from("manuscrits").select("id, titre").eq("entreprise_id", eid),
        ]);
        const titres = Object.fromEntries((manuscrits ?? []).map((m) => [m.id, m.titre]));
        const rows = ventes ?? [];
        const parCanal: Record<string, { nombre: number; ca_fcfa: number }> = {};
        const parLivre: Record<string, { quantite: number; ca_fcfa: number }> = {};
        let enAttente = 0;
        let caEnAttente = 0;
        for (const v of rows) {
          const canal = v.canal_vente ?? "autre";
          parCanal[canal] = parCanal[canal] ?? { nombre: 0, ca_fcfa: 0 };
          parCanal[canal].nombre += num(v.quantite_vendue);
          parCanal[canal].ca_fcfa += num(v.montant_total_fcfa);
          const t = titres[v.manuscrit_id] ?? "Inconnu";
          parLivre[t] = parLivre[t] ?? { quantite: 0, ca_fcfa: 0 };
          parLivre[t].quantite += num(v.quantite_vendue);
          parLivre[t].ca_fcfa += num(v.montant_total_fcfa);
          if (v.statut_paiement === "en_attente") {
            enAttente += 1;
            caEnAttente += num(v.montant_total_fcfa);
          }
        }
        const top = Object.entries(parLivre).sort((a, b) => b[1].ca_fcfa - a[1].ca_fcfa).slice(0, 5)
          .map(([livre, s]) => ({ livre, ...s }));
        return {
          periode_jours: days,
          nombre_ventes: rows.length,
          chiffre_affaires_fcfa: rows.reduce((a, v) => a + num(v.montant_total_fcfa), 0),
          royalties_fcfa: rows.reduce((a, v) => a + num(v.droits_auteur_fcfa), 0),
          remises_fcfa: rows.reduce((a, v) => a + num(v.remise_fcfa), 0),
          par_canal: parCanal,
          top_livres: top,
          paiements_en_attente: { nombre: enAttente, montant_fcfa: caEnAttente },
        };
      },
    }),

    consulter_royalties: tool({
      description: "Consulte les royalties (droits d'auteur) par auteur : montants dus, payés et restants à payer.",
      inputSchema: z.object({}),
      execute: async () => {
        const eid = requireEntreprise();
        const [{ data: ventes }, { data: auteurs }, { data: manuscrits }] = await Promise.all([
          supabase.from("ventes").select("auteur_id, manuscrit_id, droits_auteur_fcfa, statut_paiement").eq("entreprise_id", eid).neq("statut_paiement", "annule"),
          supabase.from("auteurs").select("id, nom_complet").eq("entreprise_id", eid),
          supabase.from("manuscrits").select("id, auteur, auteur_id").eq("entreprise_id", eid),
        ]);
        const noms = Object.fromEntries((auteurs ?? []).map((a) => [a.id, a.nom_complet]));
        const msAuteur = Object.fromEntries((manuscrits ?? []).map((m) => [m.id, m.auteur_id ?? m.auteur]));
        const parAuteur: Record<string, { du_fcfa: number; paye_fcfa: number }> = {};
        for (const v of ventes ?? []) {
          const key = v.auteur_id ?? (msAuteur[v.manuscrit_id] as string | null) ?? "Inconnu";
          const nom = noms[key] ?? (typeof key === "string" && key.length > 30 ? "Inconnu" : key) ?? "Inconnu";
          parAuteur[nom] = parAuteur[nom] ?? { du_fcfa: 0, paye_fcfa: 0 };
          parAuteur[nom].du_fcfa += num(v.droits_auteur_fcfa);
          if (v.statut_paiement === "paye") parAuteur[nom].paye_fcfa += num(v.droits_auteur_fcfa);
        }
        return {
          auteurs: Object.entries(parAuteur).map(([auteur, s]) => ({
            auteur,
            total_du_fcfa: s.du_fcfa,
            deja_paye_fcfa: s.paye_fcfa,
            restant_a_payer_fcfa: s.du_fcfa - s.paye_fcfa,
          })),
        };
      },
    }),

    consulter_alertes: tool({
      description: "Liste les points d'attention : stocks critiques ou épuisés, contrats qui expirent bientôt, paiements de ventes en attente, notifications non lues.",
      inputSchema: z.object({}),
      execute: async () => {
        const eid = requireEntreprise();
        const [{ data: interne }, { data: externe }, { data: contrats }, { data: ventesAttente }, { data: manuscrits }] = await Promise.all([
          supabase.from("stock_interne").select("manuscrit_id, quantite_disponible, seuil_alerte").eq("entreprise_id", eid),
          supabase.from("stocks").select("manuscrit_id, librairie_nom, exemplaires_restants").eq("entreprise_id", eid).lte("exemplaires_restants", 5),
          supabase.from("contrats").select("livres, date_signature, duree_annees, statut").eq("entreprise_id", eid).eq("statut", "signe"),
          supabase.from("ventes").select("id, montant_total_fcfa").eq("entreprise_id", eid).eq("statut_paiement", "en_attente"),
          supabase.from("manuscrits").select("id, titre").eq("entreprise_id", eid),
        ]);
        const titres = Object.fromEntries((manuscrits ?? []).map((m) => [m.id, m.titre]));
        const stocksCritiques = (interne ?? [])
          .filter((s) => num(s.quantite_disponible) <= num(s.seuil_alerte))
          .map((s) => ({ livre: titres[s.manuscrit_id] ?? "?", disponible: num(s.quantite_disponible), seuil: num(s.seuil_alerte) }));
        const depotsBas = (externe ?? []).map((s) => ({ livre: titres[s.manuscrit_id] ?? "?", librairie: s.librairie_nom, restants: num(s.exemplaires_restants) }));
        const in90 = Date.now() + 90 * 86400000;
        const contratsExpirants = (contrats ?? [])
          .filter((c) => {
            if (!c.date_signature) return false;
            const fin = new Date(c.date_signature);
            fin.setFullYear(fin.getFullYear() + num(c.duree_annees));
            return fin.getTime() <= in90;
          })
          .map((c) => {
            const fin = new Date(c.date_signature!);
            fin.setFullYear(fin.getFullYear() + num(c.duree_annees));
            const livres = Array.isArray(c.livres) ? (c.livres as { titre?: string }[]).map((l) => l.titre).filter(Boolean).join(", ") : "";
            return { livres, expire_le: fin.toISOString().slice(0, 10) };
          });
        return {
          stocks_critiques: stocksCritiques,
          depots_librairies_bas: depotsBas,
          contrats_expirant_sous_90_jours: contratsExpirants,
          ventes_en_attente_paiement: { nombre: (ventesAttente ?? []).length, montant_fcfa: (ventesAttente ?? []).reduce((a, v) => a + num(v.montant_total_fcfa), 0) },
        };
      },
    }),

    consulter_manuscrits: tool({
      description: "Liste les manuscrits de la maison d'édition avec leur statut dans le workflow éditorial. Filtre optionnel par statut.",
      inputSchema: z.object({ statut: z.string().nullable().describe("Statut du workflow : recu, relecture, epreuve_1..4, maquette, echantillon, impression, publie (optionnel)") }),
      execute: async ({ statut }) => {
        const eid = requireEntreprise();
        let q = supabase.from("manuscrits").select("titre, auteur, statut, nombre_pages, created_at").eq("entreprise_id", eid).order("created_at", { ascending: false }).limit(50);
        if (statut) q = q.eq("statut", statut);
        const { data } = await q;
        return { manuscrits: data ?? [] };
      },
    }),

    creer_auteur: tool({
      description: "Crée une fiche auteur dans FIGDITIONS. Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        nom_complet: z.string().describe("Nom complet de l'auteur"),
        email: z.string().nullable().describe("Email (optionnel)"),
        telephone: z.string().nullable().describe("Téléphone (optionnel)"),
        operateur: z.enum(["Orange Money", "Moov Money"]).nullable().describe("Opérateur Mobile Money (optionnel)"),
        numero_mobile_money: z.string().nullable().describe("Numéro Mobile Money (optionnel)"),
      }),
      execute: async ({ nom_complet, email, telephone, operateur, numero_mobile_money }) => {
        const eid = requireEntreprise();
        const { data, error } = await supabase
          .from("auteurs")
          .insert({ entreprise_id: eid, nom_complet, email, telephone, operateur, numero_mobile_money })
          .select("id, nom_complet")
          .single();
        if (error) return { erreur: error.message };
        return { succes: true, resume: `Auteur « ${data.nom_complet} » créé. Retrouvez-le sur la page Auteurs.`, auteur_id: data.id };
      },
    }),

    creer_manuscrit: tool({
      description: "Crée un nouveau manuscrit (statut « recu ») dans FIGDITIONS. Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        titre: z.string().describe("Titre du livre"),
        auteur: z.string().describe("Nom de l'auteur"),
        genre: z.string().nullable().describe("Genre littéraire (optionnel)"),
        langue: z.string().nullable().describe("Langue (optionnel, défaut Français)"),
      }),
      execute: async ({ titre, auteur, genre, langue }) => {
        const eid = requireEntreprise();
        const { data: existing } = await supabase.from("manuscrits").select("id").eq("entreprise_id", eid).ilike("titre", titre).limit(1);
        if (existing && existing.length > 0) return { erreur: `Un manuscrit intitulé « ${titre} » existe déjà.` };
        const { data, error } = await supabase
          .from("manuscrits")
          .insert({ entreprise_id: eid, titre, auteur, genre, langue: langue ?? "Français", statut: "recu" })
          .select("id, titre")
          .single();
        if (error) return { erreur: error.message };
        return { succes: true, resume: `Manuscrit « ${data.titre} » créé avec le statut « Reçu ». Retrouvez-le sur la page Manuscrits.`, manuscrit_id: data.id };
      },
    }),

    enregistrer_vente_libre: tool({
      description: "Enregistre une vente libre (directe) : déduit du stock interne, crée la vente et calcule les droits d'auteur. Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        livre: z.string().describe("Titre du livre vendu"),
        quantite: z.number().describe("Nombre d'exemplaires vendus"),
        prix_unitaire_fcfa: z.number().describe("Prix unitaire final en FCFA (après remise éventuelle)"),
        prix_catalogue_fcfa: z.number().nullable().describe("Prix catalogue avant remise (optionnel)"),
        date: z.string().nullable().describe("Date de vente AAAA-MM-JJ (défaut aujourd'hui)"),
        notes: z.string().nullable().describe("Notes (optionnel)"),
      }),
      execute: async ({ livre, quantite, prix_unitaire_fcfa, prix_catalogue_fcfa, date, notes }) => {
        const eid = requireEntreprise();
        if (quantite <= 0 || prix_unitaire_fcfa <= 0) return { erreur: "La quantité et le prix doivent être supérieurs à zéro." };
        const found = await findManuscrit(supabase, eid, livre);
        if ("error" in found) return { erreur: found.error };
        const m = found.manuscrit;
        const { data: stock } = await supabase
          .from("stock_interne")
          .select("id, quantite_disponible, seuil_alerte")
          .eq("entreprise_id", eid)
          .eq("manuscrit_id", m.id)
          .maybeSingle();
        if (!stock) return { erreur: `« ${m.titre} » n'a pas de stock interne. Créez d'abord un stock sur la page Stocks, ou enregistrez une vente en librairie.` };
        if (num(stock.quantite_disponible) < quantite) {
          return { erreur: `Stock insuffisant pour « ${m.titre} » : ${num(stock.quantite_disponible)} exemplaire(s) disponible(s), ${quantite} demandé(s).` };
        }
        const { error } = await supabase.rpc("record_stock_mouvement", {
          p_manuscrit_id: m.id,
          p_type: "vente_directe",
          p_quantite: quantite,
          p_notes: notes ?? "Vente enregistrée via PR MEDMO",
          p_date: date ?? new Date().toISOString().slice(0, 10),
          p_prix_unitaire: prix_unitaire_fcfa,
          p_prix_catalogue: prix_catalogue_fcfa ?? null,
        });
        if (error) return { erreur: error.message };
        const restant = num(stock.quantite_disponible) - quantite;
        const total = quantite * prix_unitaire_fcfa;
        return {
          succes: true,
          resume: `Vente libre enregistrée : ${quantite} × « ${m.titre} » à ${fcfa(prix_unitaire_fcfa)} = ${fcfa(total)}. Stock interne restant : ${restant}${restant <= num(stock.seuil_alerte) ? " ⚠️ (sous le seuil d'alerte)" : ""}.`,
        };
      },
    }),

    enregistrer_vente_librairie: tool({
      description: "Enregistre une vente effectuée dans une librairie partenaire : met à jour le dépôt, la vente et les droits sont créés automatiquement. Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        livre: z.string().describe("Titre du livre vendu"),
        librairie: z.string().describe("Nom de la librairie"),
        quantite: z.number().describe("Nombre d'exemplaires vendus"),
        prix_unitaire_fcfa: z.number().nullable().describe("Prix unitaire en FCFA (défaut : prix du dépôt)"),
      }),
      execute: async ({ livre, librairie, quantite, prix_unitaire_fcfa }) => {
        const eid = requireEntreprise();
        if (quantite <= 0) return { erreur: "La quantité doit être supérieure à zéro." };
        const found = await findManuscrit(supabase, eid, livre);
        if ("error" in found) return { erreur: found.error };
        const m = found.manuscrit;
        const corrections = await loadCorrections(supabase, eid);
        const { data: stocksRows } = await supabase
          .from("stocks")
          .select("id, librairie_nom, exemplaires_restants, exemplaires_vendus, prix_unitaire_fcfa")
          .eq("entreprise_id", eid)
          .eq("manuscrit_id", m.id)
          .limit(500);
        const dep = resolveDepot(stocksRows ?? [], librairie, corrections);
        if ("error" in dep) return { erreur: dep.error };
        const s = dep.depot;
        if (num(s.exemplaires_restants) < quantite) {
          return { erreur: `Stock insuffisant chez ${s.librairie_nom} : ${num(s.exemplaires_restants)} exemplaire(s) restant(s), ${quantite} demandé(s).` };
        }
        const prix = prix_unitaire_fcfa && prix_unitaire_fcfa > 0 ? prix_unitaire_fcfa : num(s.prix_unitaire_fcfa);
        const { error } = await supabase
          .from("stocks")
          .update({
            prix_unitaire_fcfa: prix,
            exemplaires_vendus: num(s.exemplaires_vendus) + quantite,
            exemplaires_restants: Math.max(0, num(s.exemplaires_restants) - quantite),
          })
          .eq("id", s.id);
        if (error) return { erreur: error.message };
        const restant = Math.max(0, num(s.exemplaires_restants) - quantite);
        return {
          succes: true,
          resume: withNote(
            [found.note, dep.note].filter(Boolean).join(" ") || null,
            `Vente en librairie enregistrée : ${quantite} × « ${m.titre} » chez ${s.librairie_nom} à ${fcfa(prix)} = ${fcfa(quantite * prix)}. Il reste ${restant} exemplaire(s) sur place.${restant <= 5 ? " ⚠️ Pensez au réassort." : ""}`,
          ),
        };
      },
    }),

    creer_depot_librairie: tool({
      description: "Crée un dépôt de livres dans une librairie (stock externe). Par défaut les exemplaires sont déduits de l'entrepôt (stock interne) ; avec provenance « hors_stock » les livres déjà dehors sont enregistrés sans toucher à l'entrepôt. Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        livre: z.string().describe("Titre du livre déposé"),
        librairie: z.string().describe("Nom de la librairie"),
        adresse: z.string().nullable().describe("Adresse de la librairie (optionnel)"),
        quantite: z.number().describe("Nombre d'exemplaires déposés"),
        prix_unitaire_fcfa: z.number().nullable().describe("Prix unitaire en librairie en FCFA (défaut : prix de vente direct du livre)"),
        provenance: z.enum(["interne", "hors_stock"]).nullable().describe("« interne » = déduit de l'entrepôt (défaut) ; « hors_stock » = livres déjà chez la librairie, sans déduction de l'entrepôt"),
        date: z.string().nullable().describe("Date du dépôt AAAA-MM-JJ (défaut aujourd'hui)"),
      }),
      execute: async ({ livre, librairie, adresse, quantite, prix_unitaire_fcfa, provenance, date }) => {
        const eid = requireEntreprise();
        if (quantite <= 0) return { erreur: "La quantité doit être supérieure à zéro." };
        const found = await findManuscrit(supabase, eid, livre);
        if ("error" in found) return { erreur: found.error };
        const m = found.manuscrit;
        const dateDepot = date ?? new Date().toISOString().slice(0, 10);
        const prov = provenance ?? "interne";

        // Prix : celui fourni, sinon le prix de vente direct enregistré sur la fiche entrepôt.
        const { data: stockInt } = await supabase
          .from("stock_interne")
          .select("id, quantite_disponible, prix_vente_direct_fcfa")
          .eq("entreprise_id", eid)
          .eq("manuscrit_id", m.id)
          .maybeSingle();
        const prix = prix_unitaire_fcfa && prix_unitaire_fcfa > 0 ? prix_unitaire_fcfa : num(stockInt?.prix_vente_direct_fcfa);

        if (prov === "interne") {
          if (!stockInt) return { erreur: `« ${m.titre} » n'a pas de stock interne. Utilisez la provenance « hors_stock » si les livres sont déjà chez la librairie, ou enregistrez d'abord une impression.` };
          if (num(stockInt.quantite_disponible) < quantite) {
            return { erreur: `Stock interne insuffisant pour « ${m.titre} » : ${num(stockInt.quantite_disponible)} exemplaire(s) disponible(s), ${quantite} demandé(s). Utilisez la provenance « hors_stock » si ces livres ne viennent pas de l'entrepôt.` };
          }
        }

        // Un seul dépôt par livre et par librairie : on cumule sur la ligne existante.
        const corrections = await loadCorrections(supabase, eid);
        const { data: existingRows } = await supabase
          .from("stocks")
          .select("id, librairie_nom, exemplaires_deposes, exemplaires_restants, exemplaires_total, prix_unitaire_fcfa")
          .eq("entreprise_id", eid)
          .eq("manuscrit_id", m.id)
          .limit(500);
        const rows = existingRows ?? [];
        let existing: (typeof rows)[number] | null = null;
        let libNote: string | null = null;
        if (rows.length > 0) {
          const dep = resolveDepot(rows, librairie, corrections);
          if ("depot" in dep) {
            existing = dep.depot;
            libNote = dep.note;
          }
        }
        if (!existing) {
          // Pas de dépôt existant pour ce livre : vérifier que la librairie
          // mentionnée n'est pas une variante d'une librairie déjà connue.
          const librairies = await fetchLibrairies(supabase, eid);
          const res = resolveLibrairie(librairie, librairies, corrections);
          if (res.confiance === "moyenne" && res.match) {
            const c = besoinConfirmation(res, "librairie", (l) => l.nom);
            return { erreur: `${c.interpretation} ${c.question}` };
          }
          if (res.confiance === "haute" && res.match) {
            libNote = noteInterpretation(librairie, res.match.nom, "la librairie");
            librairie = res.match.nom;
            adresse = adresse ?? res.match.adresse;
          }
        }

        if (existing) {
          const { error } = await supabase
            .from("stocks")
            .update({
              exemplaires_deposes: num(existing.exemplaires_deposes) + quantite,
              exemplaires_restants: num(existing.exemplaires_restants) + quantite,
              exemplaires_total: num(existing.exemplaires_total) + quantite,
              prix_unitaire_fcfa: prix > 0 ? prix : num(existing.prix_unitaire_fcfa),
              derniere_visite: dateDepot,
            })
            .eq("id", existing.id);
          if (error) return { erreur: error.message };
        } else {
          const { error } = await supabase.from("stocks").insert({
            entreprise_id: eid,
            manuscrit_id: m.id,
            librairie_nom: librairie.trim(),
            librairie_adresse: adresse?.trim() || null,
            exemplaires_deposes: quantite,
            exemplaires_vendus: 0,
            exemplaires_restants: quantite,
            exemplaires_total: quantite,
            prix_unitaire_fcfa: prix,
            derniere_visite: dateDepot,
            provenance: prov,
          } as any);
          if (error) return { erreur: error.message };
        }

        let warning: string | null = null;
        if (prov === "interne") {
          const { data: res, error: rpcErr } = await supabase.rpc("apply_depot_transfert", {
            p_manuscrit_id: m.id,
            p_delta: quantite,
            p_librairie_nom: librairie.trim(),
            p_date: dateDepot,
          });
          if (rpcErr) return { erreur: `Dépôt créé mais la déduction de l'entrepôt a échoué : ${rpcErr.message}` };
          warning = (res as any)?.warning ?? null;
        }

        return {
          succes: true,
          resume:
            `Dépôt enregistré : ${quantite} × « ${m.titre} » chez ${existing ? existing.librairie_nom : librairie.trim()}` +
            (prix > 0 ? ` à ${fcfa(prix)}` : "") +
            (prov === "hors_stock"
              ? " — hors stock interne : l'entrepôt n'a pas été touché."
              : ` — ${quantite} exemplaire(s) déduit(s) de l'entrepôt.`) +
            (warning ? ` ⚠️ ${warning}` : ""),
        };
      },
    }),

    enregistrer_impression: tool({
      description: "Enregistre une impression (réimpression) : ajoute des exemplaires au stock interne de l'entrepôt. Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        livre: z.string().describe("Titre du livre imprimé"),
        quantite: z.number().describe("Nombre d'exemplaires imprimés"),
        date: z.string().nullable().describe("Date d'impression AAAA-MM-JJ (défaut aujourd'hui)"),
        notes: z.string().nullable().describe("Notes, ex. nom de l'imprimerie (optionnel)"),
      }),
      execute: async ({ livre, quantite, date, notes }) => {
        const eid = requireEntreprise();
        if (quantite <= 0) return { erreur: "La quantité doit être supérieure à zéro." };
        const found = await findManuscrit(supabase, eid, livre);
        if ("error" in found) return { erreur: found.error };
        const m = found.manuscrit;
        const { data: stock } = await supabase
          .from("stock_interne")
          .select("id, quantite_disponible")
          .eq("entreprise_id", eid)
          .eq("manuscrit_id", m.id)
          .maybeSingle();
        if (!stock) return { erreur: `« ${m.titre} » n'a pas de fiche de stock interne. Passez d'abord le manuscrit au statut « Publié » (je peux le faire avec l'outil changer_statut_manuscrit).` };
        const { error } = await supabase.rpc("record_stock_mouvement", {
          p_manuscrit_id: m.id,
          p_type: "impression",
          p_quantite: quantite,
          p_notes: notes ?? "Impression enregistrée via PR MEDMO",
          p_date: date ?? new Date().toISOString().slice(0, 10),
        });
        if (error) return { erreur: error.message };
        return {
          succes: true,
          resume: `Impression enregistrée : +${quantite} exemplaire(s) de « ${m.titre} ». Stock interne disponible : ${num(stock.quantite_disponible) + quantite}.`,
        };
      },
    }),

    retour_depot_librairie: tool({
      description: "Enregistre le retour d'exemplaires invendus d'une librairie vers l'entrepôt (stock interne). Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        livre: z.string().describe("Titre du livre retourné"),
        librairie: z.string().describe("Nom de la librairie d'où reviennent les livres"),
        quantite: z.number().describe("Nombre d'exemplaires retournés"),
        date: z.string().nullable().describe("Date du retour AAAA-MM-JJ (défaut aujourd'hui)"),
        notes: z.string().nullable().describe("Notes (optionnel)"),
      }),
      execute: async ({ livre, librairie, quantite, date, notes }) => {
        const eid = requireEntreprise();
        if (quantite <= 0) return { erreur: "La quantité doit être supérieure à zéro." };
        const found = await findManuscrit(supabase, eid, livre);
        if ("error" in found) return { erreur: found.error };
        const m = found.manuscrit;
        const { data: stocksRows } = await supabase
          .from("stocks")
          .select("id, librairie_nom, exemplaires_restants")
          .eq("entreprise_id", eid)
          .eq("manuscrit_id", m.id)
          .ilike("librairie_nom", `%${librairie}%`)
          .limit(3);
        const rows = stocksRows ?? [];
        if (rows.length === 0) return { erreur: `Aucun dépôt de « ${m.titre} » trouvé dans une librairie correspondant à « ${librairie} ».` };
        if (rows.length > 1) return { erreur: `Plusieurs dépôts correspondent : ${rows.map((r) => r.librairie_nom).join(", ")}. Précisez la librairie.` };
        const s = rows[0];
        if (num(s.exemplaires_restants) < quantite) {
          return { erreur: `Maximum retournable depuis ${s.librairie_nom} : ${num(s.exemplaires_restants)} exemplaire(s).` };
        }
        const { error } = await supabase.rpc("record_stock_mouvement", {
          p_manuscrit_id: m.id,
          p_type: "retour_librairie",
          p_quantite: quantite,
          p_provenance: "librairie",
          p_stock_externe_id: s.id,
          p_notes: notes ?? "Retour de dépôt enregistré via PR MEDMO",
          p_date: date ?? new Date().toISOString().slice(0, 10),
        });
        if (error) return { erreur: error.message };
        return {
          succes: true,
          resume: `Retour enregistré : ${quantite} × « ${m.titre} » de ${s.librairie_nom} vers l'entrepôt. Il reste ${num(s.exemplaires_restants) - quantite} exemplaire(s) sur place.`,
        };
      },
    }),

    changer_statut_manuscrit: tool({
      description: "Fait avancer un manuscrit dans le workflow éditorial (recu → relecture → epreuve_1 à 4 → maquette → echantillon → impression → publie). Le passage à « publie » crée automatiquement la fiche de stock interne. Nécessite la confirmation de l'utilisateur.",
      needsApproval: true,
      inputSchema: z.object({
        livre: z.string().describe("Titre du manuscrit"),
        nouveau_statut: z.enum(["recu", "relecture", "epreuve_1", "epreuve_2", "epreuve_3", "epreuve_4", "maquette", "echantillon", "impression", "publie"]).describe("Nouveau statut du workflow"),
      }),
      execute: async ({ livre, nouveau_statut }) => {
        const eid = requireEntreprise();
        const found = await findManuscrit(supabase, eid, livre);
        if ("error" in found) return { erreur: found.error };
        const m = found.manuscrit;
        if (m.statut === nouveau_statut) return { erreur: `« ${m.titre} » est déjà au statut « ${nouveau_statut} ».` };
        const { error } = await supabase.from("manuscrits").update({ statut: nouveau_statut }).eq("id", m.id);
        if (error) return { erreur: error.message };
        return {
          succes: true,
          resume:
            `« ${m.titre} » est passé de « ${m.statut} » à « ${nouveau_statut} ».` +
            (nouveau_statut === "publie" ? " 📘 Une fiche de stock interne a été créée automatiquement — vous pouvez maintenant enregistrer une impression." : ""),
        };
      },
    }),

    proposer_ventes_cahier: tool({
      description:
        "Après analyse d'une ou plusieurs photos de cahier de ventes : rapproche les entrées extraites des livres et librairies réels de la maison d'édition, puis affiche une carte de validation éditable. N'enregistre RIEN en base : l'utilisateur valide lui-même dans la carte.",
      inputSchema: z.object({
        nombre_photos: z.number().nullable().describe("Nombre de photos analysées"),
        entrees: z
          .array(
            z.object({
              titre_livre: z.string().nullable().describe("Titre tel qu'extrait (brut, non corrigé)"),
              quantite: z.number().nullable(),
              prix_unitaire_fcfa: z.number().nullable(),
              librairie: z.string().nullable().describe("Nom de librairie extrait, null si vente directe"),
              date: z.string().nullable().describe("AAAA-MM-JJ si identifiable, sinon null"),
              statut_paiement: z.enum(["paye", "en_attente"]).nullable(),
              auteur: z.string().nullable(),
              incertain: z.array(z.string()).nullable().describe("Noms des champs à lecture incertaine"),
            }),
          )
          .describe("Toutes les entrées extraites, toutes photos confondues"),
      }),
      execute: async ({ entrees, nombre_photos }) => {
        const eid = requireEntreprise();
        const photos = nombre_photos && nombre_photos > 0 ? Math.round(nombre_photos) : 1;

        // Journal de session (debug / amélioration du rapprochement) — best-effort.
        const logSession = async (payload: unknown) => {
          try {
            await supabase.from("medmo_ocr_logs").insert({
              entreprise_id: eid,
              user_id: userId,
              nombre_photos: photos,
              entrees: payload,
            } as any);
          } catch {
            /* journal best-effort */
          }
        };

        if (!entrees || entrees.length === 0) {
          await logSession([]);
          return {
            nombre_photos: photos,
            entreprise_id: eid,
            entrees: [] as unknown[],
            message: "Aucune donnée de vente exploitable n'a pu être extraite de l'image.",
          };
        }

        const [livres, librairies, { data: si }, corrections] = await Promise.all([
          fetchLivres(supabase, eid, true),
          fetchLibrairies(supabase, eid),
          supabase.from("stock_interne").select("manuscrit_id, prix_vente_direct_fcfa").eq("entreprise_id", eid).limit(500),
          loadCorrections(supabase, eid),
        ]);
        const prixParLivre: Record<string, number> = {};
        for (const r of si ?? []) prixParLivre[(r as any).manuscrit_id as string] = num((r as any).prix_vente_direct_fcfa);

        type LivreScore = { id: string; titre: string; score: number };
        const matchLivre = (raw: string | null) => {
          if (!raw) return { choisi: null as LivreScore | null, suggestions: [] as LivreScore[], viaCorrection: false, confiance: "faible" as const };
          const res = resolveLivre(raw, livres, corrections);
          const best = res.match ? { id: res.match.id, titre: res.match.titre, score: res.score } : null;
          const sugg = res.suggestions
            .map((s) => livres.find((l) => l.titre === s.label))
            .filter(Boolean)
            .map((l) => ({ id: l!.id, titre: l!.titre, score: 0 }));
          return { choisi: best, suggestions: sugg, viaCorrection: res.via_correction, confiance: res.confiance };
        };

        const matchLibrairie = (raw: string | null) => {
          if (!raw) return { nom: null as string | null, confiance: null, nouvelle: false };
          const res = resolveLibrairie(raw, librairies, corrections);
          if (res.match) return { nom: res.match.nom, confiance: res.confiance, nouvelle: false };
          return { nom: normalizeName(raw), confiance: res.confiance, nouvelle: true };
        };


        // Fusion des doublons (même vente photographiée deux fois).
        const seen = new Map<string, Record<string, unknown>>();
        let doublons = 0;
        for (const e of entrees) {
          const rawTitre = e.titre_livre?.trim() || null;
          const rawLib = e.librairie?.trim() || null;
          const livre = matchLivre(rawTitre);
          const lib = matchLibrairie(rawLib);
          const quantite = e.quantite && e.quantite > 0 ? Math.round(e.quantite) : null;
          const livreRetenu = livre.choisi;
          const key = [
            livreRetenu ? livreRetenu.id : normalizeMatchKey(rawTitre ?? "?"),
            normalizeMatchKey(lib.nom ?? ""),
            quantite ?? "?",
            e.date ?? "",
          ].join("|");
          if (seen.has(key)) {
            doublons++;
            continue;
          }
          const prixSuggere = livreRetenu ? (prixParLivre[livreRetenu.id] ?? null) : null;
          const prix = e.prix_unitaire_fcfa && e.prix_unitaire_fcfa > 0 ? Math.round(e.prix_unitaire_fcfa) : null;
          seen.set(key, {
            extrait_titre: rawTitre,
            extrait_librairie: rawLib,
            manuscrit_id: livreRetenu?.id ?? null,
            titre: livreRetenu?.titre ?? null,
            confiance_livre: rawTitre ? livre.confiance : "faible",
            via_correction: livre.viaCorrection,
            suggestions_livres: livre.suggestions.map((s) => ({ id: s.id, titre: s.titre })),
            librairie: lib.nom,
            nouvelle_librairie: lib.nouvelle,
            confiance_librairie: rawLib ? lib.confiance : null,

            quantite,
            prix_unitaire_fcfa: prix,
            prix_suggere: prixSuggere && prixSuggere > 0 ? prixSuggere : null,
            prix_inhabituel: !!(prix && prixSuggere && prixSuggere > 0 && Math.abs(prix - prixSuggere) / prixSuggere > 0.3),
            date: e.date ?? null,
            statut_paiement: e.statut_paiement ?? null,
            incertain: e.incertain ?? [],
          });
        }
        const out = [...seen.values()];
        await logSession(out);
        return {
          nombre_photos: photos,
          entreprise_id: eid,
          doublons_fusionnes: doublons,
          entrees: out,
          message: `${out.length} entrée(s) prête(s) à valider${doublons > 0 ? ` (${doublons} doublon(s) fusionné(s))` : ""}.`,
        };
      },
    }),
  };
}

interface ThreadRow { id: string; title: string; user_id: string; entreprise_id: string | null }

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // --- Auth: bearer token, same pattern as the Supabase function middleware ---
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Non authentifié", { status: 401 });
        }
        const token = authHeader.slice(7);
        const supabase = userClient(token);
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          return new Response("Session invalide", { status: 401 });
        }
        const userId = claimsData.claims.sub as string;

        // --- Input ---
        const body = (await request.json()) as { threadId?: string; messages?: unknown };
        if (!body.threadId || !Array.isArray(body.messages)) {
          return new Response("threadId et messages sont requis", { status: 400 });
        }

        // --- Thread ownership (RLS-scoped client: no row = not the user's thread) ---
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id, title, user_id, entreprise_id")
          .eq("id", body.threadId)
          .maybeSingle();
        if (!thread) return new Response("Conversation introuvable", { status: 404 });
        const threadRow = thread as ThreadRow;

        // Les pièces jointes des tours précédents n'ont plus leurs octets
        // (retirés à la persistance) : on les remplace par une note texte
        // pour que le modèle garde le contexte.
        const rawMessages = (body.messages as any[]).map((m) => ({
          ...m,
          parts: Array.isArray(m?.parts)
            ? m.parts.map((p: any) =>
                p?.type === "file" && typeof p?.url === "string" && p.url === ""
                  ? {
                      type: "text",
                      text: `[Pièce jointe précédente : ${p.filename ?? "fichier"} (${p.mediaType ?? "fichier"}) — contenu non conservé dans l'historique]`,
                    }
                  : p,
              )
            : m?.parts,
        }));

        // Garde : l'hébergeur plafonne la taille TOTALE des requêtes (~4,5 Mo sur
        // Vercel, historique inclus). On vise ~2,8 Mo de pièces jointes (base64)
        // pour garder une marge de sécurité — au-delà, l'hébergeur renvoie sa
        // propre page d'erreur 413 avant même que ce code ne s'exécute.
        const lastUserMsg = [...rawMessages].reverse().find((m: any) => m?.role === "user");
        const payloadChars = (lastUserMsg?.parts ?? []).reduce(
          (a: number, p: any) => a + (p?.type === "file" && typeof p.url === "string" ? p.url.length : 0),
          0,
        );
        if (payloadChars > 3_800_000) {
          return new Response(
            "Les fichiers joints sont trop lourds (environ 2,5 Mo au total maximum). Compressez-les ou envoyez-les un par un.",
            { status: 413 },
          );
        }

        let uiMessages: UIMessage[];
        try {
          uiMessages = await validateUIMessages({ messages: rawMessages });
        } catch (error) {
          if (error instanceof TypeValidationError) {
            return new Response("Messages invalides", { status: 400 });
          }
          throw error;
        }

        const geminiKey = process.env["GEMINI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];
        if (!geminiKey && !lovableKey) {
          return new Response(
            "Le service IA n'est pas configuré : ajoutez la variable GEMINI_API_KEY (clé Google AI Studio) dans les réglages de votre hébergeur, puis redéployez.",
            { status: 500 },
          );
        }
        const gateway = geminiKey ? createGeminiProvider(geminiKey) : createLovableAiGatewayProvider(lovableKey!);
        const modelId = geminiKey ? GEMINI_MODEL_ID : LOVABLE_MODEL_ID;

        // --- User context for the persona ---
        const { data: profile } = await supabase.from("profiles").select("full_name, entreprise_id").eq("id", userId).maybeSingle();
        const entrepriseId = threadRow.entreprise_id ?? profile?.entreprise_id ?? null;
        let entreprise = { nom: "votre maison d'édition", ville: "", plan: "starter" };
        if (entrepriseId) {
          const { data: e } = await supabase.from("entreprises").select("nom, ville, plan").eq("id", entrepriseId).maybeSingle();
          if (e) entreprise = { nom: e.nom, ville: e.ville ?? "", plan: e.plan ?? "starter" };
        }

        const modelMessages = await convertToModelMessages(uiMessages);

        const stream = createUIMessageStream({
          originalMessages: uiMessages,
          execute: ({ writer }) => {
            const result = streamText({
              model: gateway(modelId),
              system: buildMedmoSystemPrompt({
                userName: profile?.full_name ?? "éditeur",
                entrepriseName: entreprise.nom,
                entrepriseVille: entreprise.ville,
                plan: entreprise.plan,
              }),
              messages: modelMessages,
              tools: buildTools(supabase, userId, entrepriseId),
              stopWhen: stepCountIs(50),
              abortSignal: request.signal,
              maxOutputTokens: 4096,
            });
            writer.merge(result.toUIMessageStream({ originalMessages: uiMessages }));
          },
          onEnd: async ({ messages: finalMessages, isAborted }) => {
            if (isAborted) return;
            try {
              // Persist the full thread: replace all rows with the final state.
              // On retire les données base64 des pièces jointes pour ne pas
              // alourdir la base ; seul le nom du fichier reste dans l'historique.
              const stripFileData = (parts: unknown) =>
                Array.isArray(parts)
                  ? parts.map((p: any) =>
                      p?.type === "file" && typeof p.url === "string" && p.url.startsWith("data:")
                        ? { ...p, url: "" }
                        : p,
                    )
                  : parts;
              await supabase.from("chat_messages").delete().eq("thread_id", threadRow.id);
              const rows = finalMessages.map((m, i) => ({
                thread_id: threadRow.id,
                user_id: userId,
                message_id: m.id,
                role: m.role,
                parts: stripFileData(m.parts),
                position: i,
              }));
              if (rows.length > 0) {
                const { error } = await supabase.from("chat_messages").insert(rows);
                if (error) console.error("[chat] message persistence failed:", error.message);
              }
              // Auto-title from the first user message (ou sa première pièce jointe).
              if (threadRow.title === "Nouvelle conversation") {
                const firstUser = finalMessages.find((m) => m.role === "user");
                const text = firstUser?.parts?.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
                const firstFile = firstUser?.parts?.find((p) => p.type === "file") as
                  | { filename?: string }
                  | undefined;
                const title = text || (firstFile ? `📎 ${firstFile.filename ?? "Document joint"}` : "");
                if (title) {
                  await supabase
                    .from("chat_threads")
                    .update({ title: title.length > 60 ? `${title.slice(0, 57)}…` : title })
                    .eq("id", threadRow.id);
                }
              } else {
                await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadRow.id);
              }
            } catch (e) {
              console.error("[chat] onEnd persistence error:", e);
            }
          },
          onError: (error) => {
            console.error("[chat] stream error:", error);
            const message = error instanceof Error ? error.message : String(error);
            const lower = message.toLowerCase();
            if (message.includes("402") || lower.includes("credits")) {
              return "PR MEDMO est momentanément indisponible : les crédits IA de l'espace de travail sont épuisés. Rechargez-les dans les paramètres de facturation Lovable.";
            }
            if (message.includes("429") || lower.includes("quota") || lower.includes("rate limit")) {
              return "PR MEDMO reçoit trop de demandes en ce moment (limite du fournisseur IA atteinte). Patientez une minute puis réessayez.";
            }
            if (message.includes("401") || message.includes("403") || lower.includes("api key") || lower.includes("api_key") || lower.includes("permission denied")) {
              return "La clé du service IA (GEMINI_API_KEY) est invalide ou expirée. Vérifiez-la dans les réglages de votre hébergeur puis redéployez.";
            }
            if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("deadline")) {
              return "La réponse de PR MEDMO a pris trop de temps. Réessayez avec une demande plus courte.";
            }
            return "Une erreur est survenue pendant la réponse de PR MEDMO. Réessayez.";
          },
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
