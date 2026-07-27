// Web Push subscription helpers (client-side).
import { supabase } from "@/integrations/supabase/client";

// Public VAPID key (safe in codebase — it's the public half).
export const VAPID_PUBLIC_KEY =
  "BJWxqit4Asas6CGXI_TPIbqt020oxkGefCQKVoaFyceUovkkVR7jjXeW-CEMVrdhEZH2OraZASFjcBuwFR59AXw";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function currentPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function subscribeToPush(
  userId: string,
  entrepriseId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pushSupported()) return { ok: false, error: "Votre navigateur ne supporte pas les notifications push." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, error: "Permission refusée." };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh ?? bufToBase64Url(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? bufToBase64Url(sub.getKey("auth"));

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      entreprise_id: entrepriseId,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
}
