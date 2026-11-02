/**
 * Formats for jsPDF documents. The built-in PDF fonts cannot draw the narrow
 * no-break space that toLocaleString("fr-FR") puts between thousands (it shows
 * as "/" and stretches the line), so every PDF formats numbers here.
 */

/** 1234500 → "1 234 500 FCFA" with plain spaces. */
export function pdfFcfa(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 ? "-" : ""}${s} FCFA`;
}

/** "2026-11-01" or a Date → "01/11/2026". Anything else is returned as is. */
export function pdfDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (d instanceof Date) return d.toLocaleDateString("fr-FR");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

/** A Date → "02 novembre 2026" (plain spaces). */
export function pdfDateLongue(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).replace(/\s/g, " ");
}
