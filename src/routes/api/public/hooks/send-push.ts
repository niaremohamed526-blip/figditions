import { createFileRoute } from "@tanstack/react-router";

// Called by a Postgres trigger (via pg_net) after a new row is inserted in
// public.notifications. Fans out a Web Push message to every subscription
// registered for the target entreprise. Auth: shared secret in `apikey` header.

// Web Push RFC 8291 payload encryption + VAPID (RFC 8292) using Web Crypto.
// Runs on Cloudflare Workers (no Node crypto).

function b64UrlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function bytesToB64Url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, data as BufferSource);
  return new Uint8Array(sig);
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  const out = await hmac(prk, concat(info, new Uint8Array([1])));
  return out.slice(0, length);
}

// Import raw uncompressed EC point (65 bytes, 0x04 || X || Y) as ECDH P-256 public key.
async function importEcdhPublicRaw(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

// Encrypt payload for a Web Push subscription (aes128gcm, RFC 8291).
async function encryptPayload(
  payload: Uint8Array,
  clientPublicRaw: Uint8Array,
  authSecret: Uint8Array,
): Promise<{ body: Uint8Array; serverPubRaw: Uint8Array }> {
  // Server ephemeral ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  const clientPubKey = await importEcdhPublicRaw(clientPublicRaw);
  const sharedBits = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientPubKey }, serverKeyPair.privateKey, 256));

  // PRK_key = HKDF(auth, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const keyInfo = concat(
    strToBytes("WebPush: info\0"),
    clientPublicRaw,
    serverPubRaw,
  );
  const ikm = await hkdf(authSecret, sharedBits, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, concat(strToBytes("Content-Encoding: aes128gcm\0"), new Uint8Array([1])), 16);
  const nonce = await hkdf(salt, ikm, concat(strToBytes("Content-Encoding: nonce\0"), new Uint8Array([1])), 12);

  // Pad byte 0x02 (last record)
  const plain = concat(payload, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, plain as BufferSource));

  // aes128gcm header: salt(16) || rs(4=4096) || idlen(1=65) || keyid(65)
  const rs = new Uint8Array([0, 0, 0x10, 0]);
  const idlen = new Uint8Array([serverPubRaw.length]);
  const body = concat(salt, rs, idlen, serverPubRaw, ct);
  return { body, serverPubRaw };
}

// Sign a VAPID JWT (ES256) for a given push service audience.
async function signVapidJwt(audience: string, subject: string, privB64Url: string, pubB64Url: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };
  const b64json = (o: unknown) => bytesToB64Url(strToBytes(JSON.stringify(o)));
  const signingInput = `${b64json(header)}.${b64json(payload)}`;

  // Build PKCS#8 from raw d + uncompressed public key using JWK import.
  const d = privB64Url;
  const pub = b64UrlToBytes(pubB64Url); // 0x04 || X(32) || Y(32)
  const x = bytesToB64Url(pub.slice(1, 33));
  const y = bytesToB64Url(pub.slice(33, 65));
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d, x, y };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, strToBytes(signingInput) as BufferSource));
  return `${signingInput}.${bytesToB64Url(sig)}`;
}

async function sendOne(
  endpoint: string,
  p256dh: string,
  auth: string,
  payloadObj: Record<string, unknown>,
  vapid: { pub: string; priv: string; sub: string },
): Promise<{ status: number; endpoint: string }> {
  const clientPub = b64UrlToBytes(p256dh);
  const authSecret = b64UrlToBytes(auth);
  const payload = strToBytes(JSON.stringify(payloadObj));
  const { body } = await encryptPayload(payload, clientPub, authSecret);

  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJwt(audience, vapid.sub, vapid.priv, vapid.pub);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
      Authorization: `vapid t=${jwt}, k=${vapid.pub}`,
    },
    body: body as BodyInit,
  });
  return { status: resp.status, endpoint };
}

export const Route = createFileRoute("/api/public/hooks/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const secret = process.env.PUSH_TRIGGER_SECRET;
        if (!secret || !apikey || apikey !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const vapidPub = process.env.VAPID_PUBLIC_KEY;
        const vapidPriv = process.env.VAPID_PRIVATE_KEY;
        const vapidSub = process.env.VAPID_SUBJECT ?? "mailto:figditions@gmail.com";
        if (!vapidPub || !vapidPriv) {
          return new Response("VAPID not configured", { status: 500 });
        }

        let body: { notification_id?: string } = {};
        try { body = await request.json(); } catch { /* empty */ }
        if (!body.notification_id) return new Response("Missing notification_id", { status: 400 });

        // Publishable-key client + secret-gated RPCs: no service role key needed,
        // so this works on any host (Vercel included).
        const supaUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supaUrl || !supaKey) {
          return new Response("Supabase env not configured", { status: 500 });
        }
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

        const { data: notif } = await sb.rpc("push_dispatch_data", {
          p_notification_id: body.notification_id,
          p_secret: secret,
        }) as { data: {
          id: string; titre: string; message: string; lien: string | null;
          subscriptions: { endpoint: string; p256dh: string; auth: string }[];
        } | null };
        if (!notif) {
          return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
        }

        const subs = notif.subscriptions ?? [];
        const payloadObj = {
          titre: notif.titre,
          message: notif.message,
          lien: notif.lien,
          tag: `notif-${notif.id}`,
        };

        const vapid = { pub: vapidPub, priv: vapidPriv, sub: vapidSub };
        const results = await Promise.allSettled(
          subs.map((s) => sendOne(s.endpoint, s.p256dh, s.auth, payloadObj, vapid)),
        );

        // Cleanup dead subscriptions (404/410)
        const stale: string[] = [];
        for (const r of results) {
          if (r.status === "fulfilled" && (r.value.status === 404 || r.value.status === 410)) {
            stale.push(r.value.endpoint);
          }
        }
        if (stale.length) {
          await sb.rpc("push_dispatch_cleanup", { p_secret: secret, p_endpoints: stale });
        }

        const sent = results.filter((r) => r.status === "fulfilled" && r.value.status >= 200 && r.value.status < 300).length;
        return new Response(JSON.stringify({ ok: true, sent, total: results.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
