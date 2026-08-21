/**
 * PostgREST (Lovable Cloud) renvoie au maximum 1000 lignes par requête,
 * SANS erreur ni avertissement : les lignes au-delà sont silencieusement
 * ignorées. C'est ce qui causait des dépôts « invisibles » dans
 * l'application (ex. un livre déposé dans une librairie qui
 * n'apparaissait pas dans « Enregistrer une vente »).
 *
 * `fetchAllRows` rejoue la requête par pages de 1000 jusqu'à épuisement
 * et renvoie TOUTES les lignes.
 *
 * Usage :
 *   const rows = await fetchAllRows<Stock>(() =>
 *     supabase.from("stocks").select("*").order("created_at", { ascending: false })
 *   );
 */

const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  make: () => any,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await make().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}
