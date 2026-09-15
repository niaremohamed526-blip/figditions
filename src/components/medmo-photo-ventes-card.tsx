import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  BookOpenCheck,
  Check,
  Loader2,
  AlertTriangle,
  Store,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BookCombobox, type BookOption } from "@/components/book-combobox";
import { cn } from "@/lib/utils";

// ---- Sortie de l'outil proposer_ventes_cahier ----
interface EntreeCahier {
  extrait_titre: string | null;
  extrait_librairie: string | null;
  manuscrit_id: string | null;
  titre: string | null;
  confiance_livre: "haute" | "moyenne" | "faible";
  via_correction: boolean;
  suggestions_livres: { id: string; titre: string }[];
  librairie: string | null;
  nouvelle_librairie: boolean;
  confiance_librairie: "haute" | "moyenne" | "faible" | null;
  quantite: number | null;
  prix_unitaire_fcfa: number | null;
  prix_suggere: number | null;
  prix_inhabituel: boolean;
  date: string | null;
  statut_paiement: "paye" | "en_attente" | null;
  incertain: string[];
}

interface SortieCahier {
  nombre_photos: number;
  doublons_fusionnes?: number;
  entrees: EntreeCahier[];
  message?: string;
}

interface Ligne extends EntreeCahier {
  incluse: boolean;
}

const CONFIANCE_STYLE: Record<string, string> = {
  haute: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  moyenne: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  faible: "bg-red-500/15 text-red-400 border-red-500/30",
};

const fcfa = (n: number) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} FCFA`;

interface Resultat {
  index: number;
  ok: boolean;
  message: string;
}

/** Carte de validation « Photo → Ventes » : édition ligne par ligne puis enregistrement en masse. */
export function MedmoPhotoVentesCard({
  output,
  storageKey,
}: {
  output: SortieCahier;
  /** Clé de persistance locale : après validation, le récapitulatif survit au rechargement du fil. */
  storageKey?: string;
}) {
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    (output.entrees ?? []).map((e) => ({
      ...e,
      incluse: !!e.manuscrit_id && !!e.quantite,
    })),
  );
  const [livres, setLivres] = useState<BookOption[]>([]);
  const [librairies, setLibrairies] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [resultats, setResultats] = useState<Resultat[] | null>(null);
  const [correctionsApprises, setCorrectionsApprises] = useState(0);

  // Restaure le récapitulatif si ces ventes ont déjà été validées (évite le double enregistrement).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(`medmo-cahier:${storageKey}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as { resultats?: Resultat[]; corrections?: number };
      if (Array.isArray(saved.resultats)) {
        setResultats(saved.resultats);
        setCorrectionsApprises(saved.corrections ?? 0);
      }
    } catch {
      /* restauration best-effort */
    }
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: ms }, { data: stk }] = await Promise.all([
        supabase
          .from("manuscrits")
          .select("id, titre, auteur")
          .eq("statut", "publie")
          .order("titre"),
        supabase.from("stocks").select("librairie_nom").limit(1000),
      ]);
      if (cancelled) return;
      setLivres((ms ?? []) as BookOption[]);
      setLibrairies([...new Set((stk ?? []).map((s) => String(s.librairie_nom)))].sort());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (i: number, patch: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const selection = lignes.filter((l) => l.incluse);
  const totalEstime = selection.reduce(
    (a, l) => a + (l.quantite ?? 0) * (l.prix_unitaire_fcfa ?? l.prix_suggere ?? 0),
    0,
  );
  const datalistId = useMemo(() => `libs-${Math.random().toString(36).slice(2, 8)}`, []);

  const valider = async () => {
    if (envoi || selection.length === 0) return;
    setEnvoi(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expirée. Rechargez la page.");
      const res = await fetch("/api/medmo-ventes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entrees: selection.map((l) => ({
            manuscrit_id: l.manuscrit_id,
            titre: l.titre,
            librairie: l.librairie,
            quantite: l.quantite,
            prix_unitaire_fcfa: l.prix_unitaire_fcfa ?? l.prix_suggere,
            date: l.date,
            statut_paiement: l.statut_paiement,
            extrait_titre: l.extrait_titre,
            extrait_librairie: l.extrait_librairie,
            // Correction apprise seulement si l'utilisateur a changé le rapprochement.
            corrige_titre:
              !!l.manuscrit_id &&
              !!l.extrait_titre &&
              (l.titre ?? "").trim().toLowerCase() !==
                (l.suggestions_livres[0]?.titre ?? "").trim().toLowerCase(),
            corrige_librairie:
              !!l.extrait_librairie &&
              !!l.librairie &&
              l.extrait_librairie.trim().toLowerCase() !== l.librairie.trim().toLowerCase(),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erreur ?? "Erreur serveur");
      setResultats(json.resultats as Resultat[]);
      setCorrectionsApprises(json.corrections_apprises ?? 0);
      if (storageKey) {
        try {
          window.localStorage.setItem(
            `medmo-cahier:${storageKey}`,
            JSON.stringify({ resultats: json.resultats, corrections: json.corrections_apprises ?? 0 }),
          );
        } catch {
          /* persistance best-effort */
        }
      }
      if ((json.succes ?? 0) > 0) {
        toast.success(`${json.succes} vente(s) enregistrée(s) dans FIGDITIONS.`);
        window.dispatchEvent(new CustomEvent("medmo:threads-changed"));
      }
      if ((json.echecs ?? 0) > 0) {
        toast.warning(`${json.echecs} ligne(s) n'ont pas pu être enregistrées. Consultez le détail.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  };

  // --- Après validation : récapitulatif figé ---
  if (resultats) {
    const okCount = resultats.filter((r) => r.ok).length;
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-2 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-3.5 space-y-2.5"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--gold)]">
          <BookOpenCheck className="h-4 w-4" />
          Enregistrement terminé : {okCount}/{resultats.length} vente(s) réussie(s)
        </div>
        <div className="space-y-1.5 text-xs">
          {resultats.map((r) => (
            <div
              key={r.index}
              className={cn(
                "rounded-lg border px-3 py-2",
                r.ok
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/25 bg-red-500/10 text-red-300",
              )}
            >
              {r.ok ? "✓ " : "✗ "}
              {r.message}
            </div>
          ))}
        </div>
        {correctionsApprises > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[color:var(--gold)]" />
            PR MEDMO a mémorisé {correctionsApprises} correction(s). Il reconnaîtra mieux ces
            titres et librairies la prochaine fois.
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="my-2 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-3.5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--gold)]">
          <BookOpenCheck className="h-4 w-4" />
          Ventes détectées sur {output.nombre_photos} photo(s)
        </div>
        {(output.doublons_fusionnes ?? 0) > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {output.doublons_fusionnes} doublon(s) fusionné(s)
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Vérifiez et corrigez chaque ligne, décochez celles à ignorer, puis validez. Rien n'est
        enregistré avant votre confirmation.
      </p>

      <datalist id={datalistId}>
        {librairies.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      <div className="space-y-2">
        {lignes.map((l, i) => {
          const prixEff = l.prix_unitaire_fcfa ?? l.prix_suggere ?? null;
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border border-border bg-background/60 p-2.5 space-y-2 transition-opacity",
                !l.incluse && "opacity-45",
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={l.incluse}
                  onChange={(e) => update(i, { incluse: e.target.checked })}
                  aria-label={`Inclure la ligne ${i + 1}`}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#C8922A]"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Livre */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <BookCombobox
                      items={livres}
                      value={l.manuscrit_id ?? ""}
                      onChange={(id) => {
                        const livre = livres.find((b) => b.id === id);
                        update(i, {
                          manuscrit_id: id || null,
                          titre: livre?.titre ?? null,
                          prix_unitaire_fcfa: l.prix_unitaire_fcfa ?? l.prix_suggere,
                        });
                      }}
                      placeholder={l.extrait_titre ? `« ${l.extrait_titre} » ?` : "Choisir le livre…"}
                      emptyLabel="Aucun livre publié"
                      className="flex-1 min-w-[160px]"
                      maxVisible={6}
                    />
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        CONFIANCE_STYLE[l.confiance_livre],
                      )}
                    >
                      {l.confiance_livre}
                    </span>
                    {l.via_correction && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-[color:var(--gold)]">
                        <Sparkles className="h-2.5 w-2.5" /> reconnu
                      </span>
                    )}
                  </div>
                  {l.extrait_titre && l.titre && l.extrait_titre !== l.titre && (
                    <p className="text-[10px] text-muted-foreground">
                      Lu sur le cahier : « {l.extrait_titre} »
                    </p>
                  )}
                  {/* Quantité / prix / date */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="text-[10px] text-muted-foreground">
                      Quantité
                      <input
                        type="number"
                        min={1}
                        value={l.quantite ?? ""}
                        onChange={(e) =>
                          update(i, { quantite: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null })
                        }
                        className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-[color:var(--gold)]/60"
                      />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Prix unit. (FCFA)
                      <input
                        type="number"
                        min={0}
                        value={prixEff ?? ""}
                        onChange={(e) =>
                          update(i, { prix_unitaire_fcfa: e.target.value ? Math.round(Number(e.target.value)) : null })
                        }
                        className={cn(
                          "mt-0.5 h-8 w-full rounded-md border bg-card px-2 text-xs text-foreground outline-none focus:border-[color:var(--gold)]/60",
                          l.prix_inhabituel ? "border-amber-500/50" : "border-border",
                        )}
                      />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Date
                      <input
                        type="date"
                        value={l.date ?? ""}
                        onChange={(e) => update(i, { date: e.target.value || null })}
                        className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-1.5 text-xs text-foreground outline-none focus:border-[color:var(--gold)]/60"
                      />
                    </label>
                  </div>
                  {/* Librairie + paiement */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Store className="h-3 w-3" /> Librairie (vide = vente directe)
                      </span>
                      <input
                        type="text"
                        list={datalistId}
                        value={l.librairie ?? ""}
                        onChange={(e) => update(i, { librairie: e.target.value || null })}
                        placeholder="Vente directe"
                        className={cn(
                          "mt-0.5 h-8 w-full rounded-md border bg-card px-2 text-xs text-foreground outline-none focus:border-[color:var(--gold)]/60",
                          l.nouvelle_librairie ? "border-amber-500/50" : "border-border",
                        )}
                      />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Paiement
                      <select
                        value={l.statut_paiement ?? "paye"}
                        onChange={(e) =>
                          update(i, { statut_paiement: e.target.value as "paye" | "en_attente" })
                        }
                        className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-[color:var(--gold)]/60"
                      >
                        <option value="paye">Payé</option>
                        <option value="en_attente">En attente</option>
                      </select>
                    </label>
                  </div>
                  {(l.prix_inhabituel || l.nouvelle_librairie || l.incertain.length > 0) && (
                    <p className="flex items-start gap-1 text-[10px] text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        {l.prix_inhabituel &&
                          `Prix inhabituel (catalogue : ${l.prix_suggere ? fcfa(l.prix_suggere) : "?"}). `}
                        {l.nouvelle_librairie && "Librairie inconnue. Créez d'abord le dépôt. "}
                        {l.incertain.length > 0 && `Lecture incertaine : ${l.incertain.join(", ")}.`}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pied : total + action */}
      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--gold)]/25 pt-2.5">
        <div className="text-xs">
          <span className="font-semibold">{selection.length}</span>
          <span className="text-muted-foreground"> vente(s) — </span>
          <span className="font-semibold text-[color:var(--gold)]">{fcfa(totalEstime)}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              setLignes((ls) => ls.map((l) => ({ ...l, incluse: !!l.manuscrit_id && !!l.quantite })))
            }
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted/40"
          >
            Tout cocher
          </button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            disabled={envoi || selection.length === 0}
            onClick={() => void valider()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#C8922A,#A67420)] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {envoi ? "Enregistrement…" : `Valider ${selection.length} vente(s)`}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default MedmoPhotoVentesCard;
