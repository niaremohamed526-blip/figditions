import type { PermissionKey, Permissions } from "@/lib/permissions";

export type ChangelogItemType = "nouveaute" | "amelioration" | "correction";

export interface ChangelogItem {
  type: ChangelogItemType;
  texte: string;
  page_concernee?: string | null;
}

export interface ChangelogEntry {
  id: string;
  titre: string;
  hook: string;
  version: string | null;
  date_publication: string;
  items: ChangelogItem[];
}

export const TYPE_META: Record<ChangelogItemType, { emoji: string; label: string; color: string }> = {
  nouveaute: { emoji: "✨", label: "Nouveautés", color: "#C8922A" },
  amelioration: { emoji: "🎨", label: "Améliorations", color: "#6B9BD1" },
  correction: { emoji: "🐛", label: "Corrections", color: "#4CAF7D" },
};

export const TYPE_ORDER: ChangelogItemType[] = ["nouveaute", "amelioration", "correction"];

/** Human label for a page_concernee tag. */
const PAGE_LABELS: Record<string, string> = {
  global: "Général",
  dashboard: "Tableau de bord",
  medmo: "Pr. MEDMO",
  manuscrits: "Manuscrits",
  auteurs: "Auteurs",
  stocks: "Stocks",
  stocks_interne: "Stock Interne",
  stocks_externe: "Stock Externe",
  finances: "Finances",
  contrats: "Contrats & Droits",
  conversions: "Conversions",
  estimateur: "Estimateur",
  imprimeries: "Imprimeries",
  parametres: "Paramètres",
};

export function pageTagLabel(page?: string | null): string | null {
  if (!page) return null;
  const key = page.toLowerCase().trim();
  return PAGE_LABELS[key] ?? page;
}

/** Which permission gates a page_concernee value (null = visible to everyone). */
function permissionForTag(page?: string | null): PermissionKey | "stocks_any" | null {
  if (!page) return null;
  const key = page.toLowerCase().trim();
  if (key === "global" || key === "dashboard") return null;
  if (key === "stocks") return "stocks_any";
  if (key in PAGE_LABELS) return key as PermissionKey;
  return null;
}

function canSeeTag(page: string | null | undefined, perms: Permissions, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const need = permissionForTag(page);
  if (!need) return true;
  if (need === "stocks_any") return !!(perms.stocks_interne || perms.stocks_externe);
  if (need === "medmo") return perms.medmo !== false;
  return !!perms[need];
}

/**
 * Keep only entries the user can actually benefit from, and drop items
 * about pages they cannot access.
 */
export function filterEntriesForUser(
  entries: ChangelogEntry[],
  permissions: Permissions | null | undefined,
  isAdmin: boolean,
): ChangelogEntry[] {
  const perms = permissions ?? {};
  return entries
    .map((e) => ({ ...e, items: (e.items ?? []).filter((i) => canSeeTag(i.page_concernee, perms, isAdmin)) }))
    .filter((e) => e.items.length > 0);
}

export function groupItems(items: ChangelogItem[]) {
  return TYPE_ORDER.map((type) => ({ type, items: items.filter((i) => i.type === type) })).filter(
    (g) => g.items.length > 0,
  );
}
