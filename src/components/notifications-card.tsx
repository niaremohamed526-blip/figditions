import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  pushSupported,
  currentPushPermission,
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

export function NotificationsCard({
  userId,
  entrepriseId,
}: {
  userId: string | undefined;
  entrepriseId: string | null | undefined;
}) {
  const [supported, setSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const sup = pushSupported();
      setSupported(sup);
      setPermission(await currentPushPermission());
      setSubscribed(await isSubscribed());
    })();
  }, []);

  const enable = async () => {
    if (!userId) return;
    setBusy(true);
    const res = await subscribeToPush(userId, entrepriseId ?? null);
    setBusy(false);
    if (res.ok) {
      setSubscribed(true);
      setPermission("granted");
      toast.success("Notifications activées 🔔");
    } else {
      toast.error(res.error);
    }
  };

  const disable = async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    setSubscribed(false);
    toast.success("Notifications désactivées");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Notifications système</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Recevez une alerte (avec son) sur ce téléphone ou cet ordinateur pour chaque
            vente, stock bas, contrat expirant, royalties, etc. — même quand l'application
            est fermée.
          </p>
        </div>
      </div>

      {!supported && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          Votre navigateur ne supporte pas les notifications push.
          Sur <strong>iPhone</strong>, installez d'abord FIGDITIONS sur l'écran d'accueil
          (Partager → Sur l'écran d'accueil), puis revenez ici pour activer.
        </div>
      )}

      {supported && permission === "denied" && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-md p-3">
          Vous avez bloqué les notifications pour ce site. Pour les réactiver, ouvrez les
          paramètres du navigateur/de l'application FIGDITIONS et autorisez les
          notifications.
        </div>
      )}

      {supported && permission !== "denied" && (
        <div className="flex flex-wrap items-center gap-3">
          {!subscribed ? (
            <Button onClick={enable} disabled={busy || !userId} className="min-h-10">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
              Activer les notifications
            </Button>
          ) : (
            <Button onClick={disable} disabled={busy} variant="outline" className="min-h-10">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellOff className="h-4 w-4 mr-2" />}
              Désactiver
            </Button>
          )}
          {subscribed && (
            <span className="text-xs text-primary font-medium">✓ Activées sur cet appareil</span>
          )}
        </div>
      )}
    </div>
  );
}
