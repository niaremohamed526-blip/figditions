// Logo de filigrane des factures : stocké localement (data URL) par l'utilisateur.

const KEY = "figditions:facture-watermark";

export function getFactureWatermark(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setFactureWatermark(dataUrl: string) {
  try {
    localStorage.setItem(KEY, dataUrl);
  } catch {
    /* stockage indisponible */
  }
}

export function clearFactureWatermark() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
}

/** Lit un fichier image et le redimensionne (max 600px) en PNG data URL. */
export async function fileToWatermarkDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Veuillez choisir une image (PNG, JPG…)");
  }
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Image illisible"));
    i.src = raw;
  });
  const max = 600;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}
