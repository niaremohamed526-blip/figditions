import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, ShoppingCart, Wallet, ReceiptText, Loader2, User } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtFCFA, methodeLabel, type AuditRow } from "@/lib/finance-types";
import { cn } from "@/lib/utils";
import { humanizeSystemValue } from "@/lib/format";

const ACTION_META: Record<string, { label: string; className: string }> = {
  insert: { label: "Création", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  update: { label: "Modification", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  delete: { label: "Suppression", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const ENTITE_META: Record<string, { label: string; icon: typeof ShoppingCart }> = {
  ventes: { label: "Vente", icon: ShoppingCart },
  depenses: { label: "Dépense", icon: Wallet },
  paiements_royalties: { label: "Paiement royalties", icon: ReceiptText },
};

function num(v: unknown): number {
  return Math.round(Number(v ?? 0));
}

function summarize(e: AuditRow): string {
  const a = (e.details?.apres ?? {}) as Record<string, unknown>;
  const b = (e.details?.avant ?? {}) as Record<string, unknown>;

  if (e.entite === "ventes") {
    if (e.action === "insert")
      return `Vente de ${num(a.quantite_vendue)} ex. : ${fmtFCFA(num(a.montant_total_fcfa))} (droits : ${fmtFCFA(num(a.droits_auteur_fcfa))})`;
    if (e.action === "delete")
      return `Vente supprimée : ${num(b.quantite_vendue)} ex. : ${fmtFCFA(num(b.montant_total_fcfa))}`;
    const changes: string[] = [];
    if (a.statut_paiement !== b.statut_paiement)
      changes.push(`droits : ${b.statut_paiement === "paye" ? "payés" : "en attente"} → ${a.statut_paiement === "paye" ? "payés" : String(a.statut_paiement)}`);
    if (a.statut_encaissement !== b.statut_encaissement)
      changes.push(`encaissement : ${humanizeSystemValue(String(b.statut_encaissement ?? ""))} → ${humanizeSystemValue(String(a.statut_encaissement ?? ""))}`);
    if (num(a.montant_encaisse_fcfa) !== num(b.montant_encaisse_fcfa))
      changes.push(`encaissé : ${fmtFCFA(num(b.montant_encaisse_fcfa))} → ${fmtFCFA(num(a.montant_encaisse_fcfa))}`);
    if (num(a.montant_total_fcfa) !== num(b.montant_total_fcfa))
      changes.push(`montant : ${fmtFCFA(num(b.montant_total_fcfa))} → ${fmtFCFA(num(a.montant_total_fcfa))}`);
    return changes.length ? changes.join(" • ") : "Vente modifiée";
  }

  if (e.entite === "depenses") {
    if (e.action === "insert") return `Dépense « ${String(a.libelle ?? "")} » : ${fmtFCFA(num(a.montant_fcfa))}`;
    if (e.action === "delete") return `Dépense supprimée « ${String(b.libelle ?? "")} » : ${fmtFCFA(num(b.montant_fcfa))}`;
    if (num(a.montant_fcfa) !== num(b.montant_fcfa))
      return `Dépense « ${String(a.libelle ?? "")} » : ${fmtFCFA(num(b.montant_fcfa))} → ${fmtFCFA(num(a.montant_fcfa))}`;
    return `Dépense « ${String(a.libelle ?? "")} » modifiée`;
  }

  if (e.entite === "paiements_royalties") {
    return `Quittance ${String(a.numero ?? "")} : ${String(a.auteur_nom ?? "")} : ${fmtFCFA(num(a.montant_fcfa))} (${methodeLabel(String(a.methode ?? ""))})`;
  }

  return `${humanizeSystemValue(e.entite)} ${humanizeSystemValue(e.action).toLocaleLowerCase("fr-FR")}`;
}

export function JournalTab() {
  const [entiteFilter, setEntiteFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["finance-audit-log"],
    queryFn: () =>
      fetchAllRows<AuditRow>(() =>
        (supabase as any).from("finance_audit_log").select("*").order("created_at", { ascending: false }),
      ),
  });

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (entiteFilter === "all" || e.entite === entiteFilter) &&
          (actionFilter === "all" || e.action === actionFilter),
      ),
    [entries, entiteFilter, actionFilter],
  );

  return (
    <Card className="bg-card/70">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-[color:var(--gold)]" />
              Journal d'audit financier
            </CardTitle>
            <CardDescription>
              Historique immuable de chaque opération : qui, quoi, quand : avec les valeurs avant/après.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={entiteFilter} onValueChange={setEntiteFilter}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="ventes">Ventes</SelectItem>
                <SelectItem value="depenses">Dépenses</SelectItem>
                <SelectItem value="paiements_royalties">Paiements royalties</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                <SelectItem value="insert">Créations</SelectItem>
                <SelectItem value="update">Modifications</SelectItem>
                <SelectItem value="delete">Suppressions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement du journal…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-muted-foreground text-sm">
            Aucune opération enregistrée pour ces filtres.
          </p>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((e) => {
              const em = ENTITE_META[e.entite] ?? { label: e.entite, icon: History };
              const am = ACTION_META[e.action] ?? ACTION_META.update;
              const Icon = em.icon;
              return (
                <div
                  key={e.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--gold)]/10">
                    <Icon className="h-4 w-4 text-[color:var(--gold)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{em.label}</span>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", am.className)}>
                        {am.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">{summarize(e)}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {e.user_nom ?? "Système"} ·{" "}
                      {new Date(e.created_at).toLocaleString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
