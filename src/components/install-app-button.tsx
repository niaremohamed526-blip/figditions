import { useState } from "react";
import { CheckCircle2, Download, MoreVertical, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwaInstall, type Plateforme } from "@/lib/pwa-install";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";

type T = (fr: string, en: string) => string;

function etapes(p: Plateforme, t: T): { icone: React.ReactNode; texte: string }[] {
  if (p === "ios") return [
    { icone: <Share className="h-4 w-4" />, texte: t("Dans Safari, touchez le bouton Partager en bas de l'écran.", "In Safari, tap the Share button at the bottom of the screen.") },
    { icone: <SquarePlus className="h-4 w-4" />, texte: t("Choisissez « Sur l'écran d'accueil ».", "Choose \"Add to Home Screen\".") },
    { icone: <CheckCircle2 className="h-4 w-4" />, texte: t("Touchez « Ajouter » : l'icône FIGDITIONS apparaît sur votre écran.", "Tap \"Add\": the FIGDITIONS icon appears on your screen.") },
  ];
  if (p === "android") return [
    { icone: <MoreVertical className="h-4 w-4" />, texte: t("Dans Chrome, touchez le menu ⋮ en haut à droite.", "In Chrome, tap the ⋮ menu at the top right.") },
    { icone: <Download className="h-4 w-4" />, texte: t("Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».", "Choose \"Install app\" or \"Add to Home screen\".") },
    { icone: <CheckCircle2 className="h-4 w-4" />, texte: t("Confirmez : FIGDITIONS s'ouvre comme une application.", "Confirm: FIGDITIONS opens like an app.") },
  ];
  if (p === "mac-safari") return [
    { icone: <Share className="h-4 w-4" />, texte: t("Dans Safari, ouvrez le menu Fichier.", "In Safari, open the File menu.") },
    { icone: <SquarePlus className="h-4 w-4" />, texte: t("Choisissez « Ajouter au Dock ».", "Choose \"Add to Dock\".") },
    { icone: <CheckCircle2 className="h-4 w-4" />, texte: t("FIGDITIONS s'ouvre depuis le Dock, comme une application.", "FIGDITIONS opens from the Dock, like an app.") },
  ];
  return [
    { icone: <Download className="h-4 w-4" />, texte: t("Ouvrez figditions.xyz dans Google Chrome ou Microsoft Edge.", "Open figditions.xyz in Google Chrome or Microsoft Edge.") },
    { icone: <SquarePlus className="h-4 w-4" />, texte: t("Cliquez sur l'icône d'installation à droite de la barre d'adresse (ou menu ⋮, « Installer FIGDITIONS »).", "Click the install icon at the right of the address bar (or ⋮ menu, \"Install FIGDITIONS\").") },
    { icone: <CheckCircle2 className="h-4 w-4" />, texte: t("FIGDITIONS s'ouvre dans sa propre fenêtre, avec une icône sur votre bureau.", "FIGDITIONS opens in its own window, with an icon on your desktop.") },
  ];
}

/**
 * "Installer l'application": one click where the browser allows it,
 * otherwise the 3 steps for this device. Hidden once installed.
 */
export function InstallAppButton({ className, variant = "outline", size, full }: {
  className?: string;
  variant?: "outline" | "default" | "ghost";
  size?: "default" | "sm" | "lg";
  full?: boolean;
}) {
  const { t } = useI18n();
  const { pret, installee, direct, plateforme, installer } = usePwaInstall();
  const [aide, setAide] = useState(false);

  if (!pret || installee) return null;

  const onClick = async () => {
    if (direct) {
      await installer();
      return;
    }
    setAide(true);
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={onClick} className={cn(full && "w-full", className)}>
        <Download className="h-4 w-4" />
        {t("Installer l'application", "Install the app")}
      </Button>
      <Dialog open={aide} onOpenChange={setAide}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Installer FIGDITIONS", "Install FIGDITIONS")}</DialogTitle>
            <DialogDescription>
              {t(
                "Une icône sur votre écran, l'application en plein écran, et vos données consultables même sans connexion.",
                "An icon on your screen, the app full screen, and your data readable even offline.",
              )}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {etapes(plateforme, t).map((e, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">{e.icone}</span>
                <span className="pt-1">{e.texte}</span>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
