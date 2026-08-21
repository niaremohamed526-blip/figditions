import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, PenLine, Loader2, Pencil, Trash2, Mail, Phone, Smartphone } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AnalyticsSection, defaultRange, inRange, EmptyChart, type DateRange } from "@/components/analytics-section";
import { fcfa } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/auteurs")({
  component: AuteursPage,
  head: () => ({ meta: [{ title: "Auteurs — FIGDITIONS" }] }),
});

interface Auteur {
  id: string;
  nom_complet: string;
  email: string | null;
  telephone: string | null;
  numero_mobile_money: string | null;
  operateur: string | null;
  created_at: string;
}

function AuteursPage() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [items, setItems] = useState<Auteur[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Auteur | null>(null);
  const [toDelete, setToDelete] = useState<Auteur | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setItems(null);
    // fetchAllRows : contourne la limite silencieuse de 1000 lignes de l'API.
    const list = await fetchAllRows<Auteur>(() =>
      (supabase as any).from("auteurs").select("*").order("created_at", { ascending: false }),
    ).catch((e: any) => { toast.error(e?.message ?? "Erreur de chargement"); return [] as Auteur[]; });
    setItems(list);

    // Counts of manuscripts per author (match by auteur_id OR by name)
    const msList = await fetchAllRows<any>(() => supabase.from("manuscrits").select("auteur, id, auteur_id" as any));
    const c: Record<string, number> = {};
    for (const a of list) {
      c[a.id] = ((msList ?? []) as any[]).filter(
        (m) => m.auteur_id === a.id || (m.auteur && m.auteur.toLowerCase() === a.nom_complet.toLowerCase())
      ).length;
    }
    setCounts(c);
  };

  useEffect(() => { if (profile?.entreprise_id) load(); }, [profile?.entreprise_id]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((a) =>
      q.trim() === "" || a.nom_complet.toLowerCase().includes(q.toLowerCase())
    );
  }, [items, q]);

  const openNew = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (a: Auteur) => { setEditing(a); setSheetOpen(true); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("auteurs").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Auteur supprimé");
    setItems((prev) => prev?.filter((x) => x.id !== toDelete.id) ?? prev);
    setToDelete(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auteurs</h1>
          <p className="text-muted-foreground mt-1">Gérez votre catalogue d'auteurs et leurs paiements Mobile Money.</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Ajouter un auteur
        </Button>
      </header>

      <AuthorAnalytics auteurs={items ?? []} entrepriseId={profile?.entreprise_id ?? null} />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher par nom…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-card" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered === null ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={(items?.length ?? 0) > 0} onAdd={openNew} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Nom complet</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Téléphone</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Opérateur</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Numéro MM</th>
                  <th className="px-4 py-3 font-medium text-center">Manuscrits</th>
                  <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="group border-t border-border hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link to="/auteurs/$auteurId" params={{ auteurId: a.id }} className="hover:text-primary transition-colors">
                        {a.nom_complet}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{a.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{a.telephone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {a.operateur ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                          a.operateur === "Orange Money"
                            ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }`}>{a.operateur}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{a.numero_mobile_money ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-8 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2">
                        {counts[a.id] ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/15 hover:text-primary" onClick={() => openEdit(a)} title="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive" onClick={() => setToDelete(a)} title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? "Modifier l'auteur" : "Ajouter un auteur"}</SheetTitle></SheetHeader>
          <AuteurForm
            key={editing?.id ?? "new"}
            entrepriseId={profile?.entreprise_id ?? null}
            existing={editing}
            onSaved={() => { setSheetOpen(false); load(); }}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet auteur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet auteur&nbsp;? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ hasItems, onAdd }: { hasItems: boolean; onAdd: () => void }) {
  return (
    <div className="py-16 text-center px-4">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <PenLine className="h-8 w-8" />
      </div>
      <h3 className="mt-4 font-semibold">{hasItems ? "Aucun résultat" : "Aucun auteur"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasItems ? "Essayez d'ajuster votre recherche." : "Ajoutez votre premier auteur pour commencer."}
      </p>
      {!hasItems && (
        <Button onClick={onAdd} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Ajouter un auteur
        </Button>
      )}
    </div>
  );
}

function AuteurForm({
  entrepriseId, existing, onSaved,
}: { entrepriseId: string | null; existing: Auteur | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    nom_complet: existing?.nom_complet ?? "",
    email: existing?.email ?? "",
    telephone: existing?.telephone ?? "",
    operateur: existing?.operateur ?? "",
    numero_mobile_money: existing?.numero_mobile_money ?? "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrepriseId) return toast.error("Profil non chargé");
    setLoading(true);
    const payload: any = {
      nom_complet: form.nom_complet,
      email: form.email || null,
      telephone: form.telephone || null,
      operateur: form.operateur || null,
      numero_mobile_money: form.numero_mobile_money || null,
    };
    const { error } = existing
      ? await (supabase as any).from("auteurs").update(payload).eq("id", existing.id)
      : await (supabase as any).from("auteurs").insert({ ...payload, entreprise_id: entrepriseId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Auteur mis à jour" : "Auteur ajouté avec succès");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-6">
      <div className="space-y-2">
        <Label>Nom complet</Label>
        <Input required value={form.nom_complet} onChange={(e) => setForm({ ...form, nom_complet: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Téléphone</Label>
        <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+223 ..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Opérateur</Label>
          <Select value={form.operateur} onValueChange={(v) => setForm({ ...form, operateur: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Orange Money">Orange Money</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Numéro MM</Label>
          <Input value={form.numero_mobile_money} onChange={(e) => setForm({ ...form, numero_mobile_money: e.target.value })} />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (existing ? "Enregistrer les modifications" : "Ajouter l'auteur")}
      </Button>
    </form>
  );
}

type AuthorRow = { id: string; nom_complet: string; manuscripts: number; copies: number; revenue: number; paid: number; pending: number };

function AuthorAnalytics({ auteurs, entrepriseId }: { auteurs: Auteur[]; entrepriseId: string | null }) {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [ventes, setVentes] = useState<any[] | null>(null);
  const [manuscrits, setManuscrits] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<"copies" | "revenue" | "paid" | "pending" | "manuscripts">("revenue");

  useEffect(() => {
    if (!entrepriseId) return;
    (async () => {
      const [v, m] = await Promise.all([
        fetchAllRows<any>(() => supabase.from("ventes").select("auteur_id, manuscrit_id, quantite_vendue, montant_total_fcfa, droits_auteur_fcfa, statut_paiement, date_vente")),
        fetchAllRows<any>(() => supabase.from("manuscrits").select("id, auteur, auteur_id")),
      ]);
      setVentes(v);
      setManuscrits(m);
    })();
  }, [entrepriseId]);

  const filteredV = useMemo(() => (ventes ?? []).filter((v) => inRange(v.date_vente, range)), [ventes, range]);

  const rows = useMemo<AuthorRow[]>(() => {
    const map = new Map<string, AuthorRow>();
    auteurs.forEach((a) => map.set(a.id, { id: a.id, nom_complet: a.nom_complet, manuscripts: 0, copies: 0, revenue: 0, paid: 0, pending: 0 }));
    manuscrits.forEach((m) => {
      if (m.auteur_id && map.has(m.auteur_id)) map.get(m.auteur_id)!.manuscripts += 1;
      else {
        const match = auteurs.find((a) => a.nom_complet.toLowerCase() === (m.auteur ?? "").toLowerCase());
        if (match) map.get(match.id)!.manuscripts += 1;
      }
    });
    filteredV.forEach((v) => {
      let aid = v.auteur_id;
      if (!aid) {
        const m = manuscrits.find((x) => x.id === v.manuscrit_id);
        aid = m?.auteur_id;
      }
      const row = aid ? map.get(aid) : undefined;
      if (!row) return;
      row.copies += Number(v.quantite_vendue || 0);
      row.revenue += Number(v.montant_total_fcfa || 0);
      const dr = Number(v.droits_auteur_fcfa || 0);
      if (v.statut_paiement === "paye") row.paid += dr; else row.pending += dr;
    });
    return [...map.values()].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [auteurs, manuscrits, filteredV, sortKey]);

  const royaltyMonths = useMemo(() => {
    const buckets: { label: string; key: string; paid: number; pending: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: fr }), paid: 0, pending: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    filteredV.forEach((v) => {
      const b = map.get(v.date_vente?.slice(0, 7));
      if (!b) return;
      const dr = Number(v.droits_auteur_fcfa || 0);
      if (v.statut_paiement === "paye") b.paid += dr; else b.pending += dr;
    });
    return buckets;
  }, [filteredV]);

  if (ventes === null) return <Skeleton className="h-24 w-full" />;

  const medals = ["🥇", "🥈", "🥉"];
  const sortBtn = (key: typeof sortKey, label: string) => (
    <button onClick={() => setSortKey(key)} className={`text-left ${sortKey === key ? "text-primary" : ""}`}>
      {label} {sortKey === key && "↓"}
    </button>
  );

  return (
    <AnalyticsSection title="📊 Analytiques auteurs" range={range} setRange={setRange}>
      <div className="rounded-xl border border-border bg-background/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium w-12">#</th>
                <th className="px-3 py-2 font-medium">Auteur</th>
                <th className="px-3 py-2 font-medium text-center">{sortBtn("manuscripts", "Manuscrits")}</th>
                <th className="px-3 py-2 font-medium text-right">{sortBtn("copies", "Vendus")}</th>
                <th className="px-3 py-2 font-medium text-right">{sortBtn("revenue", "Revenu")}</th>
                <th className="px-3 py-2 font-medium text-right">{sortBtn("paid", "Royalties payées")}</th>
                <th className="px-3 py-2 font-medium text-right">{sortBtn("pending", "En attente")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7}><EmptyChart label="Aucune donnée auteur" /></td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{i < 3 ? medals[i] : i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.nom_complet}</td>
                  <td className="px-3 py-2 text-center">{r.manuscripts}</td>
                  <td className="px-3 py-2 text-right">{r.copies}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fcfa(r.revenue)}</td>
                  <td className="px-3 py-2 text-right text-primary">{fcfa(r.paid)}</td>
                  <td className="px-3 py-2 text-right text-orange-400">{fcfa(r.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/40 p-5">
        <h3 className="font-semibold mb-3">💰 Droits d'auteur (6 derniers mois)</h3>
        <div className="h-64">
          {royaltyMonths.every((b) => b.paid === 0 && b.pending === 0) ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={royaltyMonths}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#1A1208", border: "1px solid #1E3A5F", borderRadius: 8 }} formatter={(v: number) => fcfa(v)} />
                <Legend />
                <Bar dataKey="paid" name="Payées" stackId="a" fill="#C8922A" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" name="En attente" stackId="a" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AnalyticsSection>
  );
}
