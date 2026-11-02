// Personal copy of a shared manuscript: the reader's name, the date and a
// unique code are written into every page of the PDF itself, so a copy that
// leaves the reading page still shows who received it.

import { degrees, PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

export interface Destinataire {
  nom: string;
  email?: string | null;
  entreprise?: string | null;
  code: string;
  date: Date;
  titre: string;
}

/** Codes without look-alike characters (0/O, 1/I), easy to read on a photo. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function nouveauCode(): string {
  const octets = crypto.getRandomValues(new Uint8Array(8));
  const c = [...octets].map((o) => ALPHABET[o % ALPHABET.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** The standard PDF font only has Latin letters: keep accents it knows, simplify the rest. */
export function texteSur(s: string): string {
  return [...s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")]
    .map((ch) => {
      const n = ch.codePointAt(0)!;
      if ((n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff)) return ch;
      const simple = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return /^[\x20-\x7e]$/.test(simple) ? simple : "?";
    })
    .join("")
    .slice(0, 160);
}

function dateFr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export async function marquerExemplaire(source: Uint8Array, d: Destinataire): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(source, { ignoreEncryption: true, updateMetadata: false });
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const or = rgb(0.78, 0.57, 0.16);

  const nom = texteSur(d.nom);
  const diagonale = texteSur(`Exemplaire de ${d.nom}  ·  ${d.code}`);
  const pied = texteSur(
    [
      `Exemplaire personnel de ${d.nom}`,
      d.email,
      d.entreprise,
      dateFr(d.date),
      `Code ${d.code}`,
      "Reproduction interdite",
    ].filter(Boolean).join("  ·  "),
  );

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    // Light diagonal lines across the whole page.
    const taille = Math.max(10, Math.min(width, height) / 26);
    const largeur = gras.widthOfTextAtSize(diagonale, taille);
    const pas = taille * 7;
    for (let y = -height; y < height * 1.6; y += pas) {
      for (let x = -largeur; x < width + largeur; x += largeur + taille * 4) {
        page.drawText(diagonale, {
          x, y, size: taille, font: gras, color: or, opacity: 0.11, rotate: degrees(30),
        });
      }
    }

    // Clear line at the foot of every page.
    const taillePied = Math.max(6, Math.min(8, width / 80));
    let ligne = pied;
    while (ligne.length > 20 && normal.widthOfTextAtSize(ligne, taillePied) > width - 24) ligne = ligne.slice(0, -2);
    if (ligne !== pied) ligne = `${ligne.trimEnd()}...`;
    page.drawRectangle({ x: 0, y: 0, width, height: taillePied + 10, color: rgb(1, 1, 1), opacity: 0.85 });
    page.drawText(ligne, { x: 12, y: 5, size: taillePied, font: normal, color: rgb(0.35, 0.27, 0.12) });
  }

  pdf.setTitle(texteSur(d.titre));
  pdf.setSubject(texteSur(`Exemplaire personnel de ${nom}, code ${d.code}`));
  pdf.setKeywords([d.code, "FIGDITIONS"]);
  pdf.setProducer("FIGDITIONS");
  pdf.setCreator("FIGDITIONS, partage sécurisé");
  return await pdf.save();
}
