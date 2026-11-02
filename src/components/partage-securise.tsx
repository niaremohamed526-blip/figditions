import { useEffect, useState } from "react";
import {
  AppWindow, Ban, CalendarClock, Camera, CheckCircle2, Clipboard, Code2, Copy, History,
  Loader2, Lock, Plus, Power, Printer, Search, ShieldAlert, Trash2, UserX, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { debutDuMois } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Partage {
  id: string; token: string; nom_lecteur: string; email_lecteur: string | null;
  entreprise_lecteur: string | null; nombre_vues_max: number;
  nombre_vues_actuel: number; est_actif: boolean; created_at: string;
  last_viewed_at: string | null; expire_le?: string | null;
}

interface Acces {
  id: string; partage_id: string | null; resultat: "success" | "denied" | "event"; raison: string | null;
  ip_addr: string | null; user_agent: string | null; nom_saisi: string | null;
  code_exemplaire?: string | null; pays?: string | null; created_at: string;
}

const lienDe = (token: string) => `${window.location.origin}/lecture/${token}`;
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const estExpire = (p: Partage) => !!p.expire_le && new Date(p.expire_le).getTime() <= Date.now();

type Statut = "actif" | "desactive" | "expire" | "epuise";
function statutDe(p: Partage): Statut {
  if (!p.est_actif) return "desactive";
  if (estExpire(p)) return "expire";
  if (p.nombre_vues_actuel >= p.nombre_vues_max) return "epuise";
  return "actif";
}
const STATUTS: Record<Statut, { label: string; cls: string }> = {
  actif: { label: "Actif", cls: "bg-primary/15 text-primary" },
  desactive: { label: "Désactivé", cls: "bg-muted text-muted-foreground" },
  expire: { label: "Expiré", cls: "bg-destructive/15 text-destructive" },
  epuise: { label: "Lectures épuisées", cls: "bg-destructive/15 text-destructive" },
};

/** Phone or computer, and browser, read from the user agent. */
function appareil(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  const os = /iPhone|iPad/.test(ua) ? "iPhone / iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Autre";
  const nav = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return nav ? `${os} · ${nav}` : os;
}

function paysDe(code?: string | null): string | null {
  if (!code || code === "XX" || code === "T1") return null;
  try { return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function decrire(a: Acces): { icone: LucideIcon; titre: string; ton: "ok" | "alerte" | "neutre" } {
  if (a.resultat === "success") return { icone: CheckCircle2, titre: "Exemplaire ouvert", ton: "ok" };
  if (a.resultat === "event") {
    switch (a.raison) {
      case "capture": return { icone: Camera, titre: "Capture d'écran tentée", ton: "alerte" };
      case "fenetre_quittee": return { icone: AppWindow, titre: "A quitté la page de lecture", ton: "neutre" };
      case "outils_dev": return { icone: Code2, titre: "Outils de développement ouverts", ton: "alerte" };
      case "impression": return { icone: Printer, titre: "Impression tentée", ton: "alerte" };
      case "copie": return { icone: Clipboard, titre: "Copie du texte tentée", ton: "alerte" };
    }
  }
  switch (a.raison) {
    case "identity_mismatch": return { icone: UserX, titre: "Nom ou email incorrect", ton: "alerte" };
    case "rate_limited": return { icone: ShieldAlert, titre: "Bloqué après trop d'essais", ton: "alerte" };
    case "expired": return { icone: CalendarClock, titre: "Ouverture refusée : lien expiré", ton: "neutre" };
    case "exhausted": return { icone: Ban, titre: "Ouverture refusée : lectures épuisées", ton: "neutre" };
    case "disabled": return { icone: Power, titre: "Ouverture refusée : lien désactivé", ton: "neutre" };
    default: return { icone: Ban, titre: "Ouverture refusée", ton: "neutre" };
  }
}

const TONS = {
  ok: "bg-primary/12 text-primary",
  alerte: "bg-destructive/12 text-destructive",
  neutre: "bg-muted text-muted-foreground",
};

/** The secure sharing card of a manuscript: links, history, code search. */
export function PartagesSection({
  partages, peutCreer, pdfPresent, onCreer, onChange,
}: {
  partages: Partage[] | null;
  peutCreer: boolean;
  pdfPresent: boolean;
  onCreer: () => void;
  onChange: () => void;
}) {
  const [historique, setHistorique] = useState<Partage | null>(null);
  const [aSupprimer, setASupprimer] = useState<Partage | null>(null);

  const copier = (p: Partage) => {
    navigator.clipboard.writeText(lienDe(p.token));
    toast.success("Lien copié");
  };
  const basculer = async (p: Partage) => {
    const { error } = await supabase.from("pdf_partages").update({ est_actif: !p.est_actif }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.est_actif ? "Lien désactivé" : "Lien réactivé");
    onChange();
  };
  const supprimer = async () => {
    if (!aSupprimer) return;
    const { error } = await supabase.from("pdf_partages").delete().eq("id", aSupprimer.id);
    if (error) return toast.error(error.message);
    toast.success("Lien supprimé");
    setASupprimer(null);
    onChange();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Lock className="h-5 w-5 shrink-0 text-primary mt-1" />
          <div>
            <h2 className="text-lg font-semibold">Partage sécurisé</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Chaque lecteur reçoit un exemplaire marqué à son nom, avec un code unique sur chaque page.
            </p>
          </div>
        </div>
        <Button disabled={!pdfPresent} onClick={onCreer} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> {peutCreer ? "Créer un lien sécurisé" : "Créer un lien (Pro)"}
        </Button>
      </div>

      {partages === null ? (
        <Skeleton className="h-28 w-full" />
      ) : partages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm text-muted-foreground">Aucun lien partagé pour le moment.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {partages.map((p) => {
            const s = statutDe(p);
            const pct = Math.min(100, Math.round((p.nombre_vues_actuel / Math.max(1, p.nombre_vues_max)) * 100));
            return (
              <li key={p.id} className="rounded-lg border border-border/70 bg-background/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold uppercase">
                    {p.nom_lecteur.trim().charAt(0) || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{p.nom_lecteur}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUTS[s].cls)}>{STATUTS[s].label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[p.entreprise_lecteur, p.email_lecteur].filter(Boolean).join(" · ") || "Lecteur indépendant"}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 max-w-[180px] overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{p.nombre_vues_actuel}/{p.nombre_vues_max} lectures</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {p.expire_le ? `${estExpire(p) ? "Expiré le" : "Expire le"} ${dateCourte(p.expire_le)}` : "Sans date limite"}
                      {p.last_viewed_at && ` · Dernière lecture ${dateCourte(p.last_viewed_at)}`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setHistorique(p)}>
                    <History className="h-4 w-4" /> Historique
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => copier(p)}>
                    <Copy className="h-4 w-4" /> Copier le lien
                  </Button>
                  <div className="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title={p.est_actif ? "Désactiver" : "Réactiver"}
                      aria-label={p.est_actif ? "Désactiver le lien" : "Réactiver le lien"} onClick={() => basculer(p)}>
                      <Power className={cn("h-4 w-4", p.est_actif ? "text-destructive" : "text-primary")} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Supprimer" aria-label="Supprimer le lien" onClick={() => setASupprimer(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RechercheCode />

      <HistoriqueSheet partage={historique} onClose={() => setHistorique(null)} />

      <Sheet open={!!aSupprimer} onOpenChange={(o) => !o && setASupprimer(null)}>
        <SheetContent side="bottom" className="bg-card border-border sm:max-w-md sm:mx-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Supprimer ce lien ?</SheetTitle>
            <SheetDescription>
              Le lien de {aSupprimer?.nom_lecteur} ne fonctionnera plus et son historique sera effacé.
              Pour simplement bloquer l'accès en gardant l'historique, désactivez-le plutôt.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setASupprimer(null)}>Annuler</Button>
            <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={supprimer}>Supprimer</Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function HistoriqueSheet({ partage, onClose }: { partage: Partage | null; onClose: () => void }) {
  const [lignes, setLignes] = useState<Acces[] | null>(null);

  useEffect(() => {
    if (!partage) return;
    setLignes(null);
    (supabase as any)
      .from("pdf_partages_acces_log")
      .select("*")
      .eq("partage_id", partage.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }: { data: Acces[] | null; error: { message: string } | null }) => {
        if (error) toast.error(error.message);
        setLignes(data ?? []);
      });
  }, [partage]);

  const alertes = (lignes ?? []).filter((l) => decrire(l).ton === "alerte").length;

  return (
    <Sheet open={!!partage} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Historique de {partage?.nom_lecteur}</SheetTitle>
          <SheetDescription>Chaque ouverture, tentative refusée et action suspecte sur ce lien.</SheetDescription>
        </SheetHeader>

        {lignes === null ? (
          <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : lignes.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">Ce lien n'a pas encore été ouvert.</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ouvertures</p>
                <p className="mt-1 text-xl font-semibold text-primary">{lignes.filter((l) => l.resultat === "success").length}</p>
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alertes</p>
                <p className={cn("mt-1 text-xl font-semibold", alertes ? "text-destructive" : "text-muted-foreground")}>{alertes}</p>
              </div>
            </div>
            <ol className="mt-5 space-y-2">
              {lignes.map((l) => {
                const d = decrire(l);
                const Icone = d.icone;
                const lieu = paysDe(l.pays);
                return (
                  <li key={l.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TONS[d.ton])}>
                      <Icone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium leading-tight">{d.titre}</p>
                        {l.code_exemplaire && l.resultat === "success" && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">{l.code_exemplaire}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateHeure(l.created_at)} · {appareil(l.user_agent)}{lieu ? ` · ${lieu}` : ""}
                      </p>
                      {l.raison === "identity_mismatch" && l.nom_saisi && (
                        <p className="mt-1 text-xs text-muted-foreground">Nom saisi : « {l.nom_saisi} »</p>
                      )}
                      {l.ip_addr && <p className="mt-0.5 text-[11px] text-muted-foreground/70 font-mono">IP {l.ip_addr}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** A copy is circulating: the code printed at the foot of its pages names the reader. */
function RechercheCode() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultat, setResultat] = useState<{ nom: string; titre: string; date: string } | "aucun" | null>(null);

  const chercher = async (e: React.FormEvent) => {
    e.preventDefault();
    const brut = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (brut.length !== 8) return toast.error("Le code a 8 caractères, par exemple YCQZ-JYZG.");
    const cle = `${brut.slice(0, 4)}-${brut.slice(4)}`;
    setBusy(true);
    const { data: acces } = await (supabase as any)
      .from("pdf_partages_acces_log")
      .select("partage_id, created_at")
      .eq("code_exemplaire", cle)
      .eq("resultat", "success")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!acces?.partage_id) { setBusy(false); return setResultat("aucun"); }
    const { data: p } = await supabase.from("pdf_partages").select("nom_lecteur, manuscrit_id").eq("id", acces.partage_id).maybeSingle();
    const { data: m } = p ? await supabase.from("manuscrits").select("titre").eq("id", p.manuscrit_id).maybeSingle() : { data: null };
    setBusy(false);
    setResultat(p ? { nom: p.nom_lecteur, titre: m?.titre ?? "Manuscrit", date: dateHeure(acces.created_at) } : "aucun");
  };

  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-4">
      <p className="text-sm font-medium flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Une copie circule ?</p>
      <p className="text-xs text-muted-foreground mt-1">
        Saisissez le code imprimé en bas de ses pages pour savoir à qui cet exemplaire a été remis.
      </p>
      <form onSubmit={chercher} className="mt-3 flex gap-2">
        <Input value={code} onChange={(e) => { setCode(e.target.value); setResultat(null); }} placeholder="ex. YCQZ-JYZG"
          className="font-mono uppercase max-w-[200px]" maxLength={9} aria-label="Code de l'exemplaire" />
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
        </Button>
      </form>
      {resultat === "aucun" && <p className="mt-3 text-sm text-muted-foreground">Aucun exemplaire de votre maison ne porte ce code.</p>}
      {resultat && resultat !== "aucun" && (
        <p className="mt-3 text-sm">
          Exemplaire de <span className="font-semibold text-primary">{resultat.nom}</span>, « {resultat.titre} », ouvert le {resultat.date}.
        </p>
      )}
    </div>
  );
}

const VALIDITES: { value: string; label: string; jours: number | null }[] = [
  { value: "1", label: "1 jour", jours: 1 },
  { value: "7", label: "7 jours", jours: 7 },
  { value: "30", label: "30 jours", jours: 30 },
  { value: "0", label: "Sans limite", jours: null },
];

export function CreatePartageForm({
  manuscritId, entrepriseId, userId, onCreated, maxParMois,
}: { manuscritId: string; entrepriseId: string | null; userId: string | null; onCreated: () => void; maxParMois: number }) {
  const [form, setForm] = useState({
    nom_lecteur: "", email_lecteur: "", entreprise_lecteur: "", nombre_vues_max: "3", validite: "30",
  });
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return;
    setLoading(true);
    if (maxParMois !== Infinity) {
      const { count } = await supabase
        .from("pdf_partages")
        .select("id", { count: "exact", head: true })
        .eq("entreprise_id", entrepriseId)
        .gte("created_at", debutDuMois());
      if ((count ?? 0) >= maxParMois) {
        setLoading(false);
        return toast.error(`Vous avez créé vos ${maxParMois} liens sécurisés de ce mois. Passez au plan Business pour un partage illimité.`);
      }
    }
    const jours = VALIDITES.find((v) => v.value === form.validite)?.jours ?? null;
    const ligne: Record<string, unknown> = {
      entreprise_id: entrepriseId,
      manuscrit_id: manuscritId,
      nom_lecteur: form.nom_lecteur.trim(),
      email_lecteur: form.email_lecteur.trim() || null,
      entreprise_lecteur: form.entreprise_lecteur.trim() || null,
      nombre_vues_max: parseInt(form.nombre_vues_max, 10),
      created_by: userId,
    };
    if (jours) ligne.expire_le = new Date(Date.now() + jours * 86_400_000).toISOString();
    const { data, error } = await supabase.from("pdf_partages").insert(ligne as any).select("token").single();
    setLoading(false);
    if (error) {
      const manque = /expire_le/.test(error.message) || error.code === "PGRST204";
      return toast.error(manque ? "La durée de validité sera disponible après la mise à jour de la base de données." : error.message);
    }
    setCreatedUrl(lienDe(data.token));
    toast.success("Lien sécurisé créé");
  };

  if (createdUrl) {
    return (
      <div className="space-y-5 mt-6">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm">
            Lien prêt pour <span className="font-semibold">{form.nom_lecteur}</span>. Envoyez-le par WhatsApp ou par email :
            il devra saisir son nom{form.email_lecteur ? " et son email" : ""} pour l'ouvrir.
          </p>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={createdUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button type="button" onClick={() => { navigator.clipboard.writeText(createdUrl); toast.success("Lien copié"); }}>
            <Copy className="h-4 w-4" /> Copier
          </Button>
        </div>
        <Button variant="outline" className="w-full" onClick={onCreated}>Terminé</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 mt-6">
      <fieldset className="space-y-4">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Le lecteur</legend>
        <div className="space-y-2">
          <Label htmlFor="pl-nom">Nom complet *</Label>
          <Input id="pl-nom" required value={form.nom_lecteur} placeholder="ex. Amadou Konaté"
            onChange={(e) => setForm({ ...form, nom_lecteur: e.target.value })} />
          <p className="text-xs text-muted-foreground">Le lecteur devra saisir exactement ce nom.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pl-email">Email</Label>
          <Input id="pl-email" type="email" value={form.email_lecteur} placeholder="ex. amadou@editions.ml"
            onChange={(e) => setForm({ ...form, email_lecteur: e.target.value })} />
          <p className="text-xs text-muted-foreground">Si vous le remplissez, il sera demandé à l'ouverture.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pl-ent">Maison ou organisme</Label>
          <Input id="pl-ent" value={form.entreprise_lecteur} placeholder="ex. Éditions Jamana"
            onChange={(e) => setForm({ ...form, entreprise_lecteur: e.target.value })} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Les limites</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Lectures</Label>
            <Select value={form.nombre_vues_max} onValueChange={(v) => setForm({ ...form, nombre_vues_max: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "5", "10"].map((n) => <SelectItem key={n} value={n}>{n} lecture{n === "1" ? "" : "s"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valable</Label>
            <Select value={form.validite} onValueChange={(v) => setForm({ ...form, validite: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VALIDITES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le lien"}
      </Button>
    </form>
  );
}
