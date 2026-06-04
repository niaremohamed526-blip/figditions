import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Phone, Mail, Globe, Star, Factory, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function getSafeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/_authenticated/imprimeries")({
  component: ImprimeriesPage,
  head: () => ({ meta: [{ title: "Imprimeries — FIGDITIONS" }] }),
});

interface Imprimerie {
  id: string; nom: string; adresse: string | null; telephone: string | null;
  email: string | null; site_web: string | null;
  specialites: string[] | null; types_impression: string[] | null;
  description: string | null; est_partenaire: boolean;
}

function ImprimeriesPage() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const isAdmin = profile?.role === "admin";

  const [items, setItems] = useState<Imprimerie[] | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setItems(null);
    const { data, error } = await (supabase as any).from("imprimeries").select("*").order("est_partenaire", { ascending: false }).order("nom");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Imprimerie[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((i) => {
      if (search && !i.nom.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all") {
        const types = i.types_impression ?? [];
        if (filterType === "both" && !(types.includes("Offset") && types.includes("Numérique"))) return false;
        if (filterType === "offset" && !types.includes("Offset")) return false;
        if (filterType === "numerique" && !types.includes("Numérique")) return false;
      }
      return true;
    });
  }, [items, search, filterType]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="h-7 w-7 text-primary" /> Imprimeries à Bamako
          </h1>
          <p className="text-muted-foreground mt-1">Trouvez le bon partenaire d'impression pour votre prochain livre.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Ajouter une imprimerie
          </Button>
        )}
      </header>

      {/* Search + filters */}
      <div className="rounded-2xl border border-border bg-card p-4 grid sm:grid-cols-[1fr_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom..." className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="offset">Offset</SelectItem>
            <SelectItem value="numerique">Numérique</SelectItem>
            <SelectItem value="both">Offset + Numérique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards */}
      {filtered === null ? (
        <div className="grid md:grid-cols-2 gap-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Factory className="h-7 w-7" /></div>
          <p className="mt-3 text-sm text-muted-foreground">Aucune imprimerie ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((i) => (
            <Card key={i.id} item={i} expanded={expanded === i.id} onToggle={() => setExpanded((e) => e === i.id ? null : i.id)} />
          ))}
        </div>
      )}

      <AddImprimerieDrawer open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}

function Card({ item, expanded, onToggle }: { item: Imprimerie; expanded: boolean; onToggle: () => void }) {
  const partner = item.est_partenaire;
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-6 flex flex-col transition-all hover:-translate-y-0.5",
      partner
        ? "border-[color:var(--gold)]/60 shadow-[0_0_40px_-10px_var(--gold)] ring-1 ring-[color:var(--gold)]/30"
        : "border-border hover:border-primary/40"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {partner && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)] border border-[color:var(--gold)]/30 mb-2">
              <Star className="h-3 w-3 fill-[color:var(--gold)]" /> Partenaire officiel FIGDITIONS
            </span>
          )}
          <h3 className="text-xl font-bold leading-tight">{item.nom}</h3>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        {item.adresse && <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>{item.adresse}</span></p>}
        {item.telephone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-primary" /><a href={`tel:${item.telephone}`} className="hover:text-foreground">{item.telephone}</a></p>}
        {item.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-primary" /><a href={`mailto:${item.email}`} className="hover:text-foreground truncate">{item.email}</a></p>}
        {(() => {
          const safe = getSafeUrl(item.site_web);
          if (!safe) return null;
          return (
            <p className="flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-primary" />
              <a href={safe} target="_blank" rel="noopener noreferrer" className="hover:text-foreground truncate">
                {safe.replace(/^https?:\/\//, "")}
              </a>
            </p>
          );
        })()}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(item.types_impression ?? []).map((t) => (
          <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30">{t}</span>
        ))}
        {(item.specialites ?? []).map((s) => (
          <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">{s}</span>
        ))}
      </div>

      {item.description && (
        <p className={cn("mt-4 text-sm text-muted-foreground leading-relaxed", !expanded && "line-clamp-3 cursor-pointer")} onClick={onToggle}>
          {item.description}
        </p>
      )}
      {item.description && item.description.length > 140 && (
        <button onClick={onToggle} className="mt-1 text-xs text-primary hover:underline self-start">
          {expanded ? "Réduire" : "Voir plus"}
        </button>
      )}

      <div className="mt-5 flex gap-2">
        {item.email && <a href={`mailto:${item.email}`} className="flex-1"><Button variant="outline" className="w-full border-primary/40 hover:bg-primary/10"><Mail className="h-4 w-4 mr-2" /> Contacter</Button></a>}
        {item.telephone && <a href={`tel:${item.telephone}`}><Button variant="outline" className="border-border"><Phone className="h-4 w-4" /></Button></a>}
      </div>
    </div>
  );
}

function AddImprimerieDrawer({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "", adresse: "", telephone: "", email: "", site_web: "",
    types_impression: "", specialites: "", description: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.nom.trim()) return toast.error("Le nom est obligatoire");
    setSaving(true);
    const { error } = await (supabase as any).from("imprimeries").insert({
      nom: form.nom,
      adresse: form.adresse || null,
      telephone: form.telephone || null,
      email: form.email || null,
      site_web: form.site_web || null,
      types_impression: form.types_impression ? form.types_impression.split(",").map((s) => s.trim()).filter(Boolean) : null,
      specialites: form.specialites ? form.specialites.split(",").map((s) => s.trim()).filter(Boolean) : null,
      description: form.description || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Imprimerie ajoutée");
    onOpenChange(false);
    setForm({ nom: "", adresse: "", telephone: "", email: "", site_web: "", types_impression: "", specialites: "", description: "" });
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Ajouter une imprimerie</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-6">
          {[
            ["nom", "Nom *"], ["adresse", "Adresse"], ["telephone", "Téléphone"], ["email", "Email"], ["site_web", "Site web"],
            ["types_impression", "Types d'impression (séparés par ,)"], ["specialites", "Spécialités (séparées par ,)"],
          ].map(([k, l]) => (
            <div key={k} className="space-y-1.5">
              <Label>{l}</Label>
              <Input value={(form as any)[k]} onChange={set(k as keyof typeof form)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={4} value={form.description} onChange={set("description")} />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
