// Page permission system for FIGDITIONS team members.
// Permissions are stored as JSONB on `profiles.permissions` and `invitations.permissions`.

export type PermissionKey =
  | "dashboard"
  | "medmo"
  | "manuscrits"
  | "auteurs"
  | "stocks_interne"
  | "stocks_externe"
  | "finances"
  | "contrats"
  | "conversions"
  | "estimateur"
  | "imprimeries"
  | "parametres";

export type Permissions = Partial<Record<PermissionKey, boolean>>;

export interface PageDef {
  key: PermissionKey;
  emoji: string;
  label: string;
  description: string;
  defaultOn: boolean;
  adminOnly?: boolean;
}

export const PAGES: PageDef[] = [
  { key: "dashboard", emoji: "🏠", label: "Tableau de bord", description: "Accès aux statistiques générales", defaultOn: true },
  { key: "medmo", emoji: "🤖", label: "PR MEDMO", description: "Assistant IA : conseils, données en direct et actions", defaultOn: true },
  { key: "manuscrits", emoji: "📚", label: "Manuscrits", description: "Gérer les manuscrits et leur workflow", defaultOn: false },
  { key: "auteurs", emoji: "✍️", label: "Auteurs", description: "Gérer les fiches auteurs", defaultOn: false },
  { key: "stocks_interne", emoji: "🏭", label: "Stock Interne", description: "Gérer l'entrepôt et les mouvements", defaultOn: false },
  { key: "stocks_externe", emoji: "🏪", label: "Stock Externe", description: "Gérer les dépôts en librairies", defaultOn: false },
  { key: "finances", emoji: "💰", label: "Finances", description: "Accéder aux ventes et royalties", defaultOn: false },
  { key: "contrats", emoji: "📄", label: "Contrats & Droits", description: "Créer et gérer les contrats d'édition et droits d'auteur", defaultOn: false },
  { key: "conversions", emoji: "🔄", label: "Conversions", description: "Convertir des documents en ebook", defaultOn: false },
  { key: "estimateur", emoji: "🧮", label: "Estimateur", description: "Calculer les coûts d'impression", defaultOn: false },
  { key: "imprimeries", emoji: "🏭", label: "Imprimeries", description: "Consulter le répertoire des imprimeurs", defaultOn: false },
  { key: "parametres", emoji: "⚙️", label: "Paramètres", description: "Réservé aux administrateurs", defaultOn: false, adminOnly: true },
];

export const PRESETS: { label: string; keys: PermissionKey[] }[] = [
  { label: "Éditeur", keys: ["manuscrits", "auteurs", "contrats"] },
  { label: "Commercial", keys: ["stocks_interne", "stocks_externe"] },
  { label: "Comptable", keys: ["finances", "estimateur"] },
];

export function defaultInvitationPermissions(): Permissions {
  const p: Permissions = {};
  for (const page of PAGES) p[page.key] = page.defaultOn;
  return p;
}

export function fullPermissions(): Permissions {
  const p: Permissions = {};
  for (const page of PAGES) p[page.key] = true;
  return p;
}

export function applyPreset(current: Permissions, presetKeys: PermissionKey[]): Permissions {
  const next: Permissions = { ...current, dashboard: true };
  for (const k of presetKeys) next[k] = true;
  return next;
}

/** Resolve which permission key gates the given pathname. */
export function permissionForPath(pathname: string): PermissionKey | null {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/medmo")) return "medmo";
  if (pathname.startsWith("/manuscrits")) return "manuscrits";
  if (pathname.startsWith("/auteurs")) return "auteurs";
  if (pathname.startsWith("/finances")) return "finances";
  if (pathname.startsWith("/contrats")) return "contrats";
  if (pathname.startsWith("/conversions")) return "conversions";
  if (pathname.startsWith("/estimateur")) return "estimateur";
  if (pathname.startsWith("/imprimeries")) return "imprimeries";
  if (pathname.startsWith("/parametres")) return "parametres";
  // /stocks → accessible if either internal or external is granted; tab gating handled in page
  if (pathname.startsWith("/stocks")) return "stocks_interne";
  return null;
}

/** True if user has access to the page guarding `pathname`. Admins always pass. */
export function canAccessPath(
  pathname: string,
  permissions: Permissions | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  const key = permissionForPath(pathname);
  if (!key) return true;
  // PR MEDMO predates per-member permissions: allowed unless explicitly revoked.
  if (key === "medmo") return permissions?.medmo !== false;
  if (key === "stocks_interne") {
    return !!(permissions?.stocks_interne || permissions?.stocks_externe);
  }
  return !!permissions?.[key];
}

export function pageLabel(key: PermissionKey): string {
  return PAGES.find((p) => p.key === key)?.label ?? key;
}
