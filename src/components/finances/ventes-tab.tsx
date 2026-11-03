import { useMemo, useState, type ReactNode } from "react";
import { pl } from "@/lib/plural";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Banknote, Loader2, Store, AlertTriangle, RotateCcw,
  ChevronDown, ShoppingBag, FileText, SlidersHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { withSessionRecovery } from "@/lib/session-recovery";
import { Eyebrow, Montant, Panel, PanelHeader, Pastille, Vide, GOLD_BUTTON, fmtMontant } from "@/components/finances/finance-ui";
import { generateFactureVentePdf } from "@/lib/pdf-facture-vente";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type VenteRow } from "@/lib/finance-types";
import { fcfa } from "@/lib/format";

const PAGE = 30;
const dateCourte = (d: string) => format(new Date(d), "d MMM yyyy", { locale: fr });

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-[#C8922A] bg-[#C8922A] text-white" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface ManuscritLite { id: string; titre: string; auteur: string; auteur_id: string | null; }
interface AuteurLite { id: string; nom_complet: string; }

interface VenteGroupe {
  key: string;
  /** « librairie » = un dépôt (librairie + date) · « panier » = une vente libre multi-livres. */
  kind: "librairie" | "panier";
  librairie_nom: string;
  date_vente: string;
  facture_numero?: string | null;
  remise_pct?: number;
  total_avant_remise?: number;
  lignes: VenteRow[];
  total_qte: number;
  total_montant: number;
  total_commission: number;
  total_droits: number;
  total_reste: number;
  nb_actives: number;
}

export function VentesTab({
  ventes,
  manuscrits,
  auteurs,
  onChanged,
  hideDroits = false,
  entrepriseNom = "Maison d'édition",
  entrepriseVille = null,
  entrepriseAdresse = null,
  entrepriseTelephone = null,
  entrepriseEmail = null,
}: {
  ventes: VenteRow[];
  manuscrits: ManuscritLite[];
  auteurs: AuteurLite[];
  onChanged: () => void;
  /** Livres étrangers : la colonne « Droits d'auteur » ne s'applique pas. */
  hideDroits?: boolean;
  entrepriseNom?: string;
  entrepriseVille?: string | null;
  entrepriseAdresse?: string | null;
  entrepriseTelephone?: string | null;
  entrepriseEmail?: string | null;
}) {

  const [search, setSearch] = useState("");
  const [canalFilter, setCanalFilter] = useState("all");
  const [royFilter, setRoyFilter] = useState("all");
  const [encFilter, setEncFilter] = useState("all");
  const [annulationFilter, setAnnulationFilter] = useState<"actives" | "annulees" | "toutes">("actives");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [plusFiltres, setPlusFiltres] = useState(false);
  const [limiteGroupes, setLimiteGroupes] = useState(PAGE);
  const [limiteLibres, setLimiteLibres] = useState(PAGE);

  // Encaissement individuel (ventes libres)
  const [encVente, setEncVente] = useState<VenteRow | null>(null);
  const [encMontant, setEncMontant] = useState("");
  const [encDate, setEncDate] = useState(new Date().toISOString().slice(0, 10));
  const [encBusy, setEncBusy] = useState(false);

  // Annulation individuelle
  const [cancelVente, setCancelVente] = useState<VenteRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  // Actions de groupe
  const [encGroupe, setEncGroupe] = useState<VenteGroupe | null>(null);
  const [encGroupeDate, setEncGroupeDate] = useState(new Date().toISOString().slice(0, 10));
  const [encGroupeBusy, setEncGroupeBusy] = useState(false);
  const [choixGroupe, setChoixGroupe] = useState<VenteGroupe | null>(null);
  const [cancelGroupe, setCancelGroupe] = useState<VenteGroupe | null>(null);
  const [cancelGroupeReason, setCancelGroupeReason] = useState("");
  const [cancelGroupeBusy, setCancelGroupeBusy] = useState(false);

  const manuscritMap = useMemo(() => new Map(manuscrits.map((m) => [m.id, m])), [manuscrits]);
  const auteurMap = useMemo(() => new Map(auteurs.map((a) => [a.id, a.nom_complet])), [auteurs]);

  const auteurDe = (v: VenteRow): string => {
    const aid = v.auteur_id ?? manuscritMap.get(v.manuscrit_id)?.auteur_id;
    return (aid && auteurMap.get(aid)) || manuscritMap.get(v.manuscrit_id)?.auteur || "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ventes.filter((v) => {
      if (annulationFilter === "actives" && v.statut_annulation === "annulee") return false;
      if (annulationFilter === "annulees" && v.statut_annulation !== "annulee") return false;
      if (canalFilter !== "all" && (v.canal_vente ?? "interne") !== canalFilter) return false;
      if (royFilter !== "all" && v.statut_paiement !== royFilter) return false;
      if (encFilter !== "all" && (v.statut_encaissement ?? "en_attente") !== encFilter) return false;
      if (from && v.date_vente < from) return false;
      if (to && v.date_vente > to) return false;
      if (q) {
        const m = manuscritMap.get(v.manuscrit_id);
        const hay = `${m?.titre ?? ""} ${auteurDe(v)} ${v.librairie_nom ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes, search, canalFilter, royFilter, encFilter, annulationFilter, from, to, manuscritMap, auteurMap]);

  const isCancelled = (v: VenteRow) => v.statut_annulation === "annulee";
  const resteDe = (v: VenteRow) =>
    isCancelled(v) ? 0 : Math.max(0, Number(v.montant_total_fcfa || 0) - Number(v.montant_encaisse_fcfa || 0));

  /**
   * Regroupement : les ventes en librairie par librairie + date, les ventes libres
   * multi-livres par panier (une transaction = une facture). Les ventes libres
   * isolées restent individuelles.
   */
  const { groupes, paniers, individuelles } = useMemo(() => {
    const map = new Map<string, VenteGroupe>();
    const individual: VenteRow[] = [];

    for (const v of filtered) {
      const externe = (v.canal_vente ?? "interne") === "externe";
      if (!externe && !v.panier_id) {
        individual.push(v);
        continue;
      }
      const kind: "librairie" | "panier" = externe ? "librairie" : "panier";
      const label = externe
        ? (v.librairie_nom?.trim() || "Librairie non précisée")
        : (v.client_nom?.trim() || "Client comptant");
      const key = externe ? `lib__${label}__${v.date_vente}` : `pan__${v.panier_id}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          kind,
          librairie_nom: label,
          date_vente: v.date_vente,
          facture_numero: v.facture_numero ?? null,
          remise_pct: Number(v.remise_pct ?? 0),
          total_avant_remise: 0,
          lignes: [],
          total_qte: 0,
          total_montant: 0,
          total_commission: 0,
          total_droits: 0,
          total_reste: 0,
          nb_actives: 0,
        };
        map.set(key, g);
      }
      g.lignes.push(v);
      if (!isCancelled(v)) {
        g.nb_actives += 1;
        g.total_qte += Number(v.quantite_vendue || 0);
        g.total_montant += Number(v.montant_total_fcfa || 0);
        g.total_commission += Number(v.commission_librairie_fcfa || 0);
        g.total_droits += Number(v.droits_auteur_fcfa || 0);
        g.total_reste += resteDe(v);
        g.total_avant_remise = (g.total_avant_remise ?? 0)
          + Number(v.montant_avant_remise_fcfa ?? v.montant_total_fcfa ?? 0);
      }
    }

    const all = [...map.values()].filter((g) => g.lignes.length > 0);
    const byDate = (a: VenteGroupe, b: VenteGroupe) =>
      a.date_vente < b.date_vente ? 1 : a.date_vente > b.date_vente ? -1 : a.librairie_nom.localeCompare(b.librairie_nom);

    individual.sort((a, b) => (a.date_vente < b.date_vente ? 1 : -1));
    return {
      groupes: all.filter((g) => g.kind === "librairie").sort(byDate),
      paniers: all.filter((g) => g.kind === "panier").sort(byDate),
      individuelles: individual,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  /** Dépôts en librairie et paniers de vente directe, dans un même fil chronologique. */
  const tousGroupes = useMemo(
    () => [...groupes, ...paniers].sort((a, b) =>
      a.date_vente < b.date_vente ? 1 : a.date_vente > b.date_vente ? -1 : a.librairie_nom.localeCompare(b.librairie_nom),
    ),
    [groupes, paniers],
  );

  /** Facture PDF d'un panier de vente directe. */
  const voirFacture = async (g: VenteGroupe) => {
    try {
      const actives = g.lignes.filter((v) => !isCancelled(v));
      const lignes = (actives.length > 0 ? actives : g.lignes).map((v) => {
        const qte = Number(v.quantite_vendue || 0);
        const pu = Number(v.prix_unitaire_fcfa || 0);
        return {
          titre: manuscritMap.get(v.manuscrit_id)?.titre ?? "Livre supprimé",
          auteur: auteurDe(v),
          quantite: qte,
          prix_unitaire: pu,
          total: Number(v.montant_avant_remise_fcfa ?? Math.round(qte * pu)),
        };
      });
      const sousTotal = lignes.reduce((a, l) => a + l.total, 0);
      const total = (actives.length > 0 ? actives : g.lignes)
        .reduce((a, v) => a + Number(v.montant_total_fcfa || 0), 0);
      const client = g.lignes[0]?.client_nom ?? null;
      await generateFactureVentePdf({
        numero: g.facture_numero ?? `FACT-${g.date_vente}`,
        dateEmission: new Date(g.date_vente).toLocaleDateString("fr-FR"),
        maison: entrepriseNom,
        maisonAdresse: entrepriseAdresse,
        maisonVille: entrepriseVille,
        maisonTelephone: entrepriseTelephone,
        maisonEmail: entrepriseEmail,
        clientNom: client,
        lignes,
        sousTotal,
        remisePct: Number(g.remise_pct ?? 0),
        remiseFcfa: Math.max(0, sousTotal - total),
        total,
      }, "download");
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de générer la facture");
    }
  };

  const totaux = useMemo(() => {
    const actives = filtered.filter((v) => !isCancelled(v));
    const somme = (f: (v: VenteRow) => number) => actives.reduce((a, v) => a + f(v), 0);
    return {
      nb: actives.length,
      qte: somme((v) => Number(v.quantite_vendue || 0)),
      ca: somme((v) => Number(v.montant_total_fcfa || 0)),
      encaisse: somme((v) => Number(v.montant_encaisse_fcfa || 0)),
      reste: somme(resteDe),
      droits: somme((v) => Number(v.droits_auteur_fcfa || 0)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const openEncaissement = (v: VenteRow) => {
    setEncVente(v);
    setEncMontant(String(resteDe(v)));
    setEncDate(new Date().toISOString().slice(0, 10));
  };

  const submitEncaissement = async () => {
    if (!encVente) return;
    const montant = Number(encMontant);
    if (!montant || montant <= 0) { toast.error("Montant invalide"); return; }
    if (montant > resteDe(encVente)) {
      toast.error(`Le montant dépasse le reste à encaisser (${fcfa(resteDe(encVente))})`);
      return;
    }
    setEncBusy(true);
    try {
      const { data, error } = await withSessionRecovery(supabase.auth, () =>
        (supabase as any).rpc("enregistrer_encaissement", {
          p_vente_id: encVente.id,
          p_montant: montant,
          p_date: encDate,
        }),
      ) as { data: any; error: any };
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error ?? "Erreur");
      toast.success(
        data.statut === "encaisse"
          ? "Vente totalement encaissée"
          : `Encaissement partiel enregistré : reste ${fcfa(data.reste)}`,
      );
      setEncVente(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'encaissement");
    } finally {
      setEncBusy(false);
    }
  };

  const openCancel = (v: VenteRow) => {
    setCancelVente(v);
    setCancelReason("");
  };

  const submitCancel = async () => {
    if (!cancelVente) return;
    setCancelBusy(true);
    try {
      const { data, error } = await withSessionRecovery(supabase.auth, () =>
        (supabase as any).rpc("annuler_vente", {
          p_vente_id: cancelVente.id,
          p_raison: cancelReason.trim() || null,
        }),
      ) as { data: any; error: any };
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error ?? "Erreur");
      toast.success(`Vente annulée : ${pl(data.quantite_reversee, "exemplaire restauré", "exemplaires restaurés")} en stock`);
      setCancelVente(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'annulation");
    } finally {
      setCancelBusy(false);
    }
  };

  /** Encaisse toutes les lignes restantes du groupe, une par une (même logique traçable). */
  const submitEncaissementGroupe = async () => {
    if (!encGroupe) return;
    const cibles = encGroupe.lignes.filter((v) => !isCancelled(v) && resteDe(v) > 0);
    if (cibles.length === 0) { toast.error("Rien à encaisser dans ce groupe"); return; }
    setEncGroupeBusy(true);
    let ok = 0;
    let montant = 0;
    try {
      // Une vente après l'autre ; on s'arrête au premier échec pour ne jamais compter deux fois.
      for (const v of cibles) {
        const reste = resteDe(v);
        const { data, error } = await withSessionRecovery(supabase.auth, () =>
          (supabase as any).rpc("enregistrer_encaissement", {
            p_vente_id: v.id,
            p_montant: reste,
            p_date: encGroupeDate,
          }),
        ) as { data: any; error: any };
        if (error || data?.ok === false) {
          const msg = error?.message ?? data?.error ?? "Erreur";
          toast.error(ok > 0
            ? `${fcfa(montant)} enregistrés, puis arrêt : ${msg}. Vérifiez avant de réessayer.`
            : msg);
          break;
        }
        ok += 1;
        montant += reste;
      }
      if (ok === cibles.length) {
        toast.success(`${pl(ok, "vente encaissée", "ventes encaissées")} : ${fcfa(montant)}`);
        setEncGroupe(null);
      }
      if (ok > 0) onChanged();
    } finally {
      setEncGroupeBusy(false);
    }
  };

  /** Annule toutes les lignes actives du groupe avec le même motif. */
  const submitCancelGroupe = async () => {
    if (!cancelGroupe) return;
    const raison = cancelGroupeReason.trim();
    if (raison.length < 10) { toast.error("Merci d'indiquer un motif (10 caractères minimum)"); return; }
    const cibles = cancelGroupe.lignes.filter((v) => !isCancelled(v));
    setCancelGroupeBusy(true);
    let ok = 0;
    let ex = 0;
    let echecs = 0;
    try {
      for (const v of cibles) {
        const { data, error } = await withSessionRecovery(supabase.auth, () =>
          (supabase as any).rpc("annuler_vente", { p_vente_id: v.id, p_raison: raison }),
        ) as { data: any; error: any };
        if (error || data?.ok === false) { echecs += 1; continue; }
        ok += 1;
        ex += Number(data?.quantite_reversee ?? 0);
      }
      if (ok > 0) toast.success(`${pl(ok, "vente annulée", "ventes annulées")} : ${pl(ex, "exemplaire restauré", "exemplaires restaurés")} en stock`);
      if (echecs > 0) toast.error(`${pl(echecs, "vente n'a pas pu être annulée", "ventes n'ont pas pu être annulées")} (droits déjà payés ?)`);
      setCancelGroupe(null);
      setCancelGroupeReason("");
      onChanged();
    } finally {
      setCancelGroupeBusy(false);
    }
  };

  const peutAnnuler = (v: VenteRow) => !isCancelled(v) && (hideDroits || v.statut_paiement !== "paye");

  const filtresActifs = canalFilter !== "all" || encFilter !== "all" || royFilter !== "all"
    || annulationFilter !== "actives" || !!from || !!to || !!search.trim();
  const effacerFiltres = () => {
    setSearch(""); setCanalFilter("all"); setEncFilter("all"); setRoyFilter("all");
    setAnnulationFilter("actives"); setFrom(""); setTo("");
  };
  const pctEncaisse = totaux.ca > 0 ? Math.min(100, Math.round((totaux.encaisse / totaux.ca) * 100)) : 0;
  const groupesVisibles = tousGroupes.slice(0, limiteGroupes);
  const libresVisibles = individuelles.slice(0, limiteLibres);

  const ouvrirEncGroupe = (g: VenteGroupe) => {
    setEncGroupeDate(new Date().toISOString().slice(0, 10));
    setEncGroupe(g);
  };
  const annulerGroupe = (g: VenteGroupe) => {
    if (g.kind === "panier") { setCancelGroupeReason(""); setCancelGroupe(g); }
    else setChoixGroupe(g);
  };

  /** Une ligne d'état courte : annulée, payée, partielle ou à encaisser. */
  const Etat = ({ v }: { v: VenteRow }) => {
    if (isCancelled(v)) return <span className="text-[11px] text-red-500">Annulée</span>;
    const reste = resteDe(v);
    if (reste <= 0) return <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Payée</span>;
    return (
      <span className={cn("text-[11px]", v.statut_encaissement === "partiel" ? "text-amber-600 dark:text-amber-400" : "text-red-500")}>
        Reste {fmtMontant(reste)}
      </span>
    );
  };

  const BoutonAnnuler = ({ v }: { v: VenteRow }) =>
    peutAnnuler(v) ? (
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-red-500 hover:text-red-400"
        onClick={(e) => { e.stopPropagation(); openCancel(v); }}
        title="Annuler cette vente"
        aria-label="Annuler cette vente"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <Panel accent className="p-5 sm:p-6">
        <Eyebrow line>{filtresActifs ? "Ventes filtrées" : "Toutes vos ventes"}</Eyebrow>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Montant value={totaux.ca} size="xl" />
            <p className="mt-2 text-sm text-muted-foreground">
              {pl(totaux.nb, "vente", "ventes")} · {pl(totaux.qte, "exemplaire", "exemplaires")}
            </p>
          </div>
          <div className={cn("grid gap-6", hideDroits ? "grid-cols-2" : "grid-cols-3")}>
            <div>
              <Eyebrow>Encaissé</Eyebrow>
              <Montant value={totaux.encaisse} size="md" tone="good" className="mt-1.5" />
            </div>
            <div>
              <Eyebrow>Reste</Eyebrow>
              <Montant value={totaux.reste} size="md" tone={totaux.reste > 0 ? "bad" : undefined} className="mt-1.5" />
            </div>
            {!hideDroits && (
              <div>
                <Eyebrow>Droits</Eyebrow>
                <Montant value={totaux.droits} size="md" className="mt-1.5" />
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pctEncaisse} % encaissé`}>
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pctEncaisse}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{pctEncaisse} % déjà encaissé</p>
      </Panel>

      {/* Filtres */}
      <Panel className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Livre, auteur, librairie…"
              aria-label="Rechercher une vente"
              className="pl-9"
            />
          </div>
          <Button variant="outline" className="rounded-md" onClick={() => setPlusFiltres((s) => !s)} aria-expanded={plusFiltres}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Plus de filtres
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={encFilter === "all"} onClick={() => setEncFilter("all")}>Toutes</Chip>
          <Chip active={encFilter === "en_attente"} onClick={() => setEncFilter(encFilter === "en_attente" ? "all" : "en_attente")}>À encaisser</Chip>
          <Chip active={encFilter === "partiel"} onClick={() => setEncFilter(encFilter === "partiel" ? "all" : "partiel")}>Partielles</Chip>
          <Chip active={encFilter === "encaisse"} onClick={() => setEncFilter(encFilter === "encaisse" ? "all" : "encaisse")}>Payées</Chip>
          <span className="mx-1 hidden w-px bg-border sm:block" aria-hidden />
          <Chip active={canalFilter === "externe"} onClick={() => setCanalFilter(canalFilter === "externe" ? "all" : "externe")}>Librairies</Chip>
          <Chip active={canalFilter === "interne"} onClick={() => setCanalFilter(canalFilter === "interne" ? "all" : "interne")}>Ventes libres</Chip>
        </div>
        {plusFiltres && (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            {!hideDroits && (
              <div className="space-y-1.5">
                <Eyebrow>Droits d'auteur</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  <Chip active={royFilter === "all"} onClick={() => setRoyFilter("all")}>Tous</Chip>
                  <Chip active={royFilter === "en_attente"} onClick={() => setRoyFilter("en_attente")}>À payer</Chip>
                  <Chip active={royFilter === "paye"} onClick={() => setRoyFilter("paye")}>Payés</Chip>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Eyebrow>Ventes annulées</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Chip active={annulationFilter === "actives"} onClick={() => setAnnulationFilter("actives")}>Masquées</Chip>
                <Chip active={annulationFilter === "toutes"} onClick={() => setAnnulationFilter("toutes")}>Affichées</Chip>
                <Chip active={annulationFilter === "annulees"} onClick={() => setAnnulationFilter("annulees")}>Seulement elles</Chip>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Eyebrow>Période</Eyebrow>
              <div className="flex gap-2">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" />
              </div>
            </div>
          </div>
        )}
        {filtresActifs && (
          <button type="button" onClick={effacerFiltres} className="text-xs text-[color:var(--gold)] underline-offset-4 hover:underline">
            Effacer les filtres
          </button>
        )}
      </Panel>

      {/* Dépôts en librairie et ventes groupées */}
      <Panel>
        <PanelHeader
          eyebrow="Librairies et factures"
          title={<>Ventes groupées <span className="font-sans text-sm text-muted-foreground">{tousGroupes.length}</span></>}
        />
        {tousGroupes.length === 0 ? (
          <Vide>Aucune vente groupée pour ces filtres.</Vide>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {groupesVisibles.map((g) => {
              const isOpen = !!expanded[g.key];
              const aEncaisser = g.total_reste > 0;
              const toutAnnule = g.nb_actives === 0;
              const toggle = () => setExpanded((s) => ({ ...s, [g.key]: !s[g.key] }));
              return (
                <li key={g.key}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Pastille
                        className={g.kind === "panier"
                          ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}
                      >
                        {g.kind === "panier" ? <ShoppingBag className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                      </Pastille>
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm font-medium", toutAnnule && "line-through opacity-60")}>
                          {g.librairie_nom}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {dateCourte(g.date_vente)} · {pl(g.nb_actives, "titre", "titres")} · {pl(g.total_qte, "ex.", "ex.")}
                          {g.kind === "panier" && g.facture_numero && <> · n° {g.facture_numero}</>}
                        </span>
                      </span>
                    </button>
                    <div className="shrink-0 text-right">
                      <p className="font-wordmark-serif text-lg leading-none tabular-nums">{fmtMontant(g.total_montant)}</p>
                      <p className="mt-1 text-[11px]">
                        {toutAnnule ? <span className="text-red-500">Annulé</span>
                          : aEncaisser ? <span className="text-red-500">Reste {fmtMontant(g.total_reste)}</span>
                          : <span className="text-emerald-600 dark:text-emerald-400">Payé</span>}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1 sm:flex">
                      {aEncaisser && (
                        <Button size="sm" className={cn("h-8 text-xs", GOLD_BUTTON)} onClick={() => ouvrirEncGroupe(g)}>
                          Encaisser
                        </Button>
                      )}
                      {g.kind === "panier" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => voirFacture(g)} title="Télécharger la facture" aria-label="Télécharger la facture">
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      {!toutAnnule && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400" onClick={() => annulerGroupe(g)} title="Annuler" aria-label="Annuler">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <button type="button" onClick={toggle} className="shrink-0 text-muted-foreground" aria-label={isOpen ? "Replier" : "Voir le détail"}>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-4">
                      <ul className="divide-y divide-border rounded-xl border border-border bg-muted/30">
                        {g.lignes.map((v) => {
                          const cancelled = isCancelled(v);
                          return (
                            <li key={v.id} className={cn("flex items-center gap-3 px-4 py-2.5", cancelled && "opacity-60")}>
                              <div className="min-w-0 flex-1">
                                <p className={cn("truncate text-sm", cancelled && "line-through")}>
                                  {manuscritMap.get(v.manuscrit_id)?.titre?.trim() ?? "Livre supprimé"}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {auteurDe(v)} · {v.quantite_vendue} × {fmtMontant(Number(v.prix_unitaire_fcfa || 0))}
                                  {!hideDroits && Number(v.droits_auteur_fcfa) > 0 && <> · droits {fmtMontant(Number(v.droits_auteur_fcfa))}</>}
                                </p>
                                {cancelled && v.raison_annulation && (
                                  <p className="truncate text-[11px] text-red-500">{v.raison_annulation}</p>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className={cn("text-sm tabular-nums", cancelled && "line-through")}>{fmtMontant(Number(v.montant_total_fcfa || 0))}</p>
                                <Etat v={v} />
                              </div>
                              <BoutonAnnuler v={v} />
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2 sm:hidden">
                        {aEncaisser && (
                          <Button size="sm" className={cn("h-8 text-xs", GOLD_BUTTON)} onClick={() => ouvrirEncGroupe(g)}>
                            <Banknote className="mr-1.5 h-3.5 w-3.5" /> Encaisser {fmtMontant(g.total_reste)}
                          </Button>
                        )}
                        {g.kind === "panier" && (
                          <Button size="sm" variant="outline" className="h-8 rounded-md text-xs" onClick={() => voirFacture(g)}>
                            <FileText className="mr-1.5 h-3.5 w-3.5" /> Facture
                          </Button>
                        )}
                        {!toutAnnule && (
                          <Button size="sm" variant="outline" className="h-8 rounded-md text-xs text-red-500" onClick={() => annulerGroupe(g)}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Annuler
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {tousGroupes.length > limiteGroupes && (
          <div className="border-t border-border p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimiteGroupes((n) => n + PAGE)}>
              Voir plus ({tousGroupes.length - limiteGroupes})
            </Button>
          </div>
        )}
      </Panel>

      {/* Ventes libres : individuelles */}
      <Panel>
        <PanelHeader
          eyebrow="Hors librairie"
          title={<>Ventes libres <span className="font-sans text-sm text-muted-foreground">{individuelles.length}</span></>}
        />
        {individuelles.length === 0 ? (
          <Vide>Aucune vente libre pour ces filtres.</Vide>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {libresVisibles.map((v) => {
              const titre = manuscritMap.get(v.manuscrit_id)?.titre?.trim() ?? "Livre supprimé";
              const reste = resteDe(v);
              const cancelled = isCancelled(v);
              return (
                <li key={v.id} className={cn("flex items-center gap-3 px-5 py-3", cancelled && "opacity-60")}>
                  <Pastille>{titre.charAt(0).toUpperCase()}</Pastille>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", cancelled && "line-through")}>{titre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dateCourte(v.date_vente)} · {auteurDe(v)} · {v.quantite_vendue} × {fmtMontant(Number(v.prix_unitaire_fcfa || 0))}
                      {Number(v.remise_fcfa) > 0 && <> · remise {fmtMontant(Number(v.remise_fcfa))}</>}
                      {!hideDroits && !cancelled && <> · droits {v.statut_paiement === "paye" ? "payés" : "à payer"}</>}
                    </p>
                    {cancelled && v.raison_annulation && (
                      <p className="truncate text-[11px] text-red-500">{v.raison_annulation}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-wordmark-serif text-lg leading-none tabular-nums", cancelled && "line-through")}>
                      {fmtMontant(Number(v.montant_total_fcfa || 0))}
                    </p>
                    <p className="mt-1"><Etat v={v} /></p>
                  </div>
                  {!cancelled && reste > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-[color:var(--gold)]"
                      onClick={() => openEncaissement(v)}
                      title="Enregistrer un paiement"
                      aria-label="Enregistrer un paiement"
                    >
                      <Banknote className="h-4 w-4" />
                    </Button>
                  )}
                  <BoutonAnnuler v={v} />
                </li>
              );
            })}
          </ul>
        )}
        {individuelles.length > limiteLibres && (
          <div className="border-t border-border p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimiteLibres((n) => n + PAGE)}>
              Voir plus ({individuelles.length - limiteLibres})
            </Button>
          </div>
        )}
      </Panel>

      {/* Dialog encaissement individuel */}
      <Dialog open={!!encVente} onOpenChange={(o) => !o && setEncVente(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer un encaissement</DialogTitle>
            <DialogDescription>
              {encVente && (
                <>
                  {manuscritMap.get(encVente.manuscrit_id)?.titre ?? "Vente"} : reste à encaisser :{" "}
                  <strong className="text-[color:var(--gold)]">{fcfa(encVente ? resteDe(encVente) : 0)}</strong>
                  {encVente.librairie_nom && <> · {encVente.librairie_nom}</>}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Montant reçu (FCFA)</Label>
              <Input
                type="number"
                min={1}
                value={encMontant}
                onChange={(e) => setEncMontant(e.target.value)}
                placeholder="Ex : 25000"
              />
              <p className="text-[11px] text-muted-foreground">
                Vous pouvez saisir un montant partiel : la vente passera en « Partiel » jusqu'au solde complet.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Date d'encaissement</Label>
              <Input type="date" value={encDate} onChange={(e) => setEncDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncVente(null)} disabled={encBusy}>Annuler</Button>
            <Button
              onClick={submitEncaissement}
              disabled={encBusy}
              className={GOLD_BUTTON}
            >
              {encBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
              Valider l'encaissement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog encaissement de groupe */}
      <Dialog open={!!encGroupe} onOpenChange={(o) => !o && setEncGroupe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{encGroupe?.kind === "panier" ? "Encaisser toute la facture" : "Encaisser tout le dépôt"}</DialogTitle>
            <DialogDescription>
              {encGroupe && (
                <>
                  Marquer comme encaissé : {pl(encGroupe.lignes.filter((v) => !isCancelled(v) && resteDe(v) > 0).length, "vente", "ventes")} pour{" "}
                  <strong>{encGroupe.librairie_nom}</strong> du {dateCourte(encGroupe.date_vente)} ?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {encGroupe && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[rgba(200,146,42,0.25)] bg-[rgba(200,146,42,0.08)] p-3 text-sm space-y-1">
                <p>Montant total : <strong className="text-[color:var(--gold)]">{fcfa(encGroupe.total_montant)}</strong></p>
                <p>Reste à encaisser : <strong className="text-[color:var(--gold)]">{fcfa(encGroupe.total_reste)}</strong></p>
                <p>Commission librairie : {fcfa(encGroupe.total_commission)}</p>
                {!hideDroits && <p>Droits d'auteur : {fcfa(encGroupe.total_droits)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date d'encaissement</Label>
                <Input type="date" value={encGroupeDate} onChange={(e) => setEncGroupeDate(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncGroupe(null)} disabled={encGroupeBusy}>Annuler</Button>
            <Button
              onClick={submitEncaissementGroupe}
              disabled={encGroupeBusy}
              className={GOLD_BUTTON}
            >
              {encGroupeBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
              Confirmer l'encaissement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Choix d'annulation de groupe */}
      <Dialog open={!!choixGroupe} onOpenChange={(o) => !o && setChoixGroupe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Que souhaitez-vous annuler ?</DialogTitle>
            <DialogDescription>
              {choixGroupe && (
                <>
                  {choixGroupe.librairie_nom} : {dateCourte(choixGroupe.date_vente)} · {pl(choixGroupe.nb_actives, "titre actif", "titres actifs")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                if (choixGroupe) setExpanded((s) => ({ ...s, [choixGroupe.key]: true }));
                setChoixGroupe(null);
              }}
            >
              Annuler une vente spécifique
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-red-500/40 text-red-400 hover:bg-red-500/10"
              onClick={() => {
                setCancelGroupe(choixGroupe);
                setCancelGroupeReason("");
                setChoixGroupe(null);
              }}
            >
              Annuler tout le groupe
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog annulation individuelle */}
      <AlertDialog open={!!cancelVente} onOpenChange={(o) => !o && setCancelVente(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Annuler cette vente ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {cancelVente && (
                <>
                  <p>
                    <strong>{manuscritMap.get(cancelVente.manuscrit_id)?.titre ?? "Vente"}</strong> : {fcfa(cancelVente.montant_total_fcfa)} : {pl(cancelVente.quantite_vendue, "exemplaire", "exemplaires")}
                  </p>

                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    <p className="font-medium text-amber-300 mb-2">Aperçu avant / après</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Avant annulation</p>
                        <p>Vente : <span className="text-red-300">{fcfa(cancelVente.montant_total_fcfa)}</span></p>
                        <p>Stock vendu : <span className="text-red-300">{cancelVente.quantite_vendue} ex.</span></p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Après annulation</p>
                        <p>Vente : <span className="text-emerald-400">annulée</span></p>
                        <p>Stock : <span className="text-emerald-400">+{cancelVente.quantite_vendue} ex.</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Motif d'annulation (optionnel)</Label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Ex : erreur de saisie, retour client, commande annulée…"
                      rows={2}
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    L'annulation est tracée dans le journal d'audit. Les ventes annulées restent visibles mais sont exclues des tableaux de bord et rapports financiers.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); submitCancel(); }}
              disabled={cancelBusy}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {cancelBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog annulation de groupe */}
      <AlertDialog open={!!cancelGroupe} onOpenChange={(o) => !o && setCancelGroupe(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Annuler tout le groupe ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {cancelGroupe && (
                <>
                  <p>
                    <strong>{cancelGroupe.librairie_nom}</strong> : {dateCourte(cancelGroupe.date_vente)} ·{" "}
                    {pl(cancelGroupe.nb_actives, "vente", "ventes")} · {pl(cancelGroupe.total_qte, "exemplaire", "exemplaires")} · {fcfa(cancelGroupe.total_montant)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Chaque ligne est annulée séparément : les exemplaires sont remis en stock titre par titre. Les ventes dont les droits d'auteur sont déjà payés seront ignorées.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Motif d'annulation (obligatoire, 10 caractères min.)</Label>
                    <Textarea
                      value={cancelGroupeReason}
                      onChange={(e) => setCancelGroupeReason(e.target.value)}
                      placeholder="Ex : dépôt saisi deux fois, bordereau erroné…"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelGroupeBusy}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); submitCancelGroupe(); }}
              disabled={cancelGroupeBusy || cancelGroupeReason.trim().length < 10}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {cancelGroupeBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              {(cancelGroupe?.nb_actives ?? 0) > 1 ? `Annuler les ${cancelGroupe?.nb_actives} ventes` : "Annuler la vente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
