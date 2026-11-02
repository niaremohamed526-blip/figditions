import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Eye, FileLock2, Loader2, Lock, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { AuthInput, authButtonClass } from "@/components/auth-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/lecture/$token")({
  component: LecturePage,
  head: () => ({ meta: [
    { title: "Lecture sécurisée | FIGDITIONS" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
});

type Raison = "not_found" | "disabled" | "exhausted" | "expired" | "no_file" | "identity_mismatch" | "rate_limited";

type ShareInfo =
  | { ok: false; reason: Raison }
  | {
      ok: true;
      share: {
        nombre_vues_max: number;
        nombre_vues_actuel: number;
        expire_le?: string | null;
        email_demande?: boolean;
      };
      manuscrit: { titre: string; auteur: string };
    };

interface Exemplaire {
  pdf: ArrayBuffer | string;
  titre: string;
  auteur: string;
  nom_lecteur: string;
  email_lecteur?: string | null;
  entreprise_lecteur: string;
  vue_actuelle: number;
  vue_max: number;
  code_exemplaire?: string;
}

const REASONS: Record<Raison, string> = {
  not_found: "Ce lien n'existe pas ou a été supprimé.",
  disabled: "Ce lien a été désactivé par l'éditeur.",
  exhausted: "Vous avez atteint le nombre maximum de lectures autorisées pour ce document.",
  expired: "Ce lien a expiré. Demandez un nouveau lien à l'éditeur.",
  no_file: "Le document n'est pas encore disponible. Contactez l'éditeur.",
  identity_mismatch: "Ces informations ne correspondent pas au destinataire enregistré. Vérifiez votre nom (et votre email s'il est demandé).",
  rate_limited: "Trop de tentatives échouées. Patientez 10 minutes avant de réessayer.",
};

// Errors the reader can fix: keep the form and show the message inline.
const RETRYABLE = new Set<Raison>(["identity_mismatch", "rate_limited"]);

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

async function ouvrir(token: string, nom: string, email: string): Promise<{ ok: true; ex: Exemplaire } | { ok: false; reason: Raison }> {
  const { data, error, response } = await supabase.functions.invoke("lecture-share", {
    body: { action: "open", token, nom_confirme: nom, email_confirme: email || undefined },
  });
  if (error) {
    const corps = await (error as { context?: Response }).context?.json?.().catch(() => null);
    return { ok: false, reason: (corps?.reason as Raison) ?? "not_found" };
  }
  // Personal copy, marked with the reader's name inside the file.
  if (data instanceof Blob) {
    const infos = JSON.parse(decodeURIComponent(response?.headers.get("x-lecture") ?? "%7B%7D"));
    return { ok: true, ex: { ...infos, pdf: await data.arrayBuffer() } };
  }
  if (data?.ok && data.pdfUrl) return { ok: true, ex: { ...data, pdf: data.pdfUrl } };
  return { ok: false, reason: (data?.reason as Raison) ?? "not_found" };
}

function LecturePage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [exemplaire, setExemplaire] = useState<Exemplaire | null>(null);
  const [bloque, setBloque] = useState<Raison | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.functions
      .invoke("lecture-share", { body: { action: "info", token } })
      .then(({ data, error }) => setInfo(error || !data ? { ok: false, reason: "not_found" } : (data as ShareInfo)));
  }, [token]);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInlineError(null);
    const r = await ouvrir(token, nom, email);
    setLoading(false);
    if (r.ok) return setExemplaire(r.ex);
    if (RETRYABLE.has(r.reason)) return setInlineError(REASONS[r.reason]);
    setBloque(r.reason);
  };

  if (!info) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-[#0A0704]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8922A]" />
      </div>
    );
  }

  if (!info.ok) return <ErrorPage reason={REASONS[info.reason] ?? REASONS.not_found} />;
  if (bloque) return <ErrorPage reason={REASONS[bloque]} />;
  if (exemplaire) return <SecureViewer token={token} data={exemplaire} />;

  const vueSuivante = info.share.nombre_vues_actuel + 1;
  const garanties: { icone: LucideIcon; texte: string }[] = [
    { icone: FileLock2, texte: "Exemplaire marqué à votre nom sur chaque page" },
    { icone: Eye, texte: `Lecture ${vueSuivante} sur ${info.share.nombre_vues_max}` },
    {
      icone: CalendarClock,
      texte: info.share.expire_le ? `Lien valable jusqu'au ${dateLongue(info.share.expire_le)}` : "Lien sans date limite",
    },
  ];

  return (
    <div className="min-h-[100svh] bg-[#0A0704] text-white flex flex-col px-6 py-10 sm:px-12">
      <Logo className="h-12 w-auto" />
      <div className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-[440px] py-10">
          <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-[#8C7B6B]">
            <span className="h-px w-8 bg-[#C8922A]" aria-hidden="true" />
            Lecture sécurisée
          </p>
          <h1 className="mt-5 font-wordmark-serif !font-normal text-white text-[38px] sm:text-[46px] leading-[1.04] !tracking-[-0.01em] break-words">
            {info.manuscrit.titre}
          </h1>
          {info.manuscrit.auteur && (
            <p className="mt-3 text-[15px] text-[#B8A898]">de <em className="italic text-[#E8B84B]">{info.manuscrit.auteur}</em></p>
          )}
          <p className="mt-6 text-[15px] leading-relaxed text-[#B8A898]">
            L'éditeur vous a confié ce manuscrit. Confirmez votre identité pour l'ouvrir.
          </p>

          <form onSubmit={handleOpen} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="nom" className="text-sm text-white/90">Votre nom complet</label>
              <AuthInput id="nom" required autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Tel qu'indiqué par l'éditeur" />
            </div>
            {info.share.email_demande !== false && (
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm text-white/90">
                  Votre email{info.share.email_demande === undefined && <span className="text-[#8C7B6B]"> (si demandé par l'éditeur)</span>}
                </label>
                <AuthInput id="email" type="email" autoComplete="email" required={info.share.email_demande === true}
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            )}
            {inlineError && (
              <div role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                {inlineError}
              </div>
            )}
            <button type="submit" disabled={loading} className={authButtonClass}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ouvrir le manuscrit"}
            </button>
          </form>

          <ul className="mt-9 space-y-3 border-t border-white/10 pt-6">
            {garanties.map(({ icone: Icone, texte }) => (
              <li key={texte} className="flex items-center gap-3 text-[13px] text-[#B8A898]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C8922A]/12 text-[#E8B84B]">
                  <Icone className="h-4 w-4" />
                </span>
                {texte}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-center text-[12px] text-[#6B5B4E]">Document protégé par FIGDITIONS. Toute reproduction est interdite.</p>
    </div>
  );
}

function ErrorPage({ reason }: { reason: string }) {
  return (
    <div className="min-h-[100svh] bg-[#0A0704] text-white flex flex-col px-6 py-10 sm:px-12">
      <Logo className="h-12 w-auto" />
      <div className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-[440px] text-center space-y-6">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C8922A]/12 text-[#E8B84B]">
            <Lock className="h-8 w-8" />
          </span>
          <p className="font-wordmark-serif text-[28px] leading-tight">{reason}</p>
          <button type="button" onClick={() => window.history.back()}
            className="inline-flex h-11 items-center rounded-md border border-white/15 px-6 text-sm text-white/90 hover:border-[#C8922A]">
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}

type Evenement = "capture" | "fenetre_quittee" | "outils_dev" | "impression" | "copie";

function SecureViewer({ token, data }: { token: string; data: Exemplaire }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [obscured, setObscured] = useState(false);
  const [obscureReason, setObscureReason] = useState<string>("");
  const dernierSignal = useRef<Partial<Record<Evenement, number>>>({});

  // Reported to the publisher's access history (at most once every 20 s per kind).
  const signaler = (type: Evenement) => {
    const maintenant = Date.now();
    if (maintenant - (dernierSignal.current[type] ?? 0) < 20_000) return;
    dernierSignal.current[type] = maintenant;
    void supabase.functions.invoke("lecture-share", {
      body: { action: "event", token, type, code: data.code_exemplaire, nom: data.nom_lecteur },
    }).catch(() => undefined);
  };

  const flashObscure = (reason: string, type: Evenement, ms = 3000) => {
    setObscureReason(reason);
    setObscured(true);
    signaler(type);
    try { navigator.clipboard?.writeText("Contenu protégé FIGDITIONS").catch(() => {}); } catch {}
    window.setTimeout(() => setObscured(false), ms);
  };

  // Right-click, saving, printing and copying are blocked; screenshots and
  // leaving the window hide the page and are reported.
  useEffect(() => {
    const onCtx = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key))) {
        e.preventDefault();
        flashObscure("Capture d'écran détectée. Contenu masqué", "capture");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "p") { e.preventDefault(); signaler("impression"); return; }
      if ((e.ctrlKey || e.metaKey) && k === "c") { e.preventDefault(); signaler("copie"); return; }
      if ((e.ctrlKey || e.metaKey) && ["s", "u", "a"].includes(k)) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "s"].includes(k)) { e.preventDefault(); signaler("outils_dev"); }
      if (e.key === "F12") { e.preventDefault(); signaler("outils_dev"); }
    };
    const onBlur = () => flashObscure("Fenêtre inactive. Contenu masqué", "fenetre_quittee", 60_000);
    const onFocus = () => setObscured(false);
    const onVis = () => {
      if (document.visibilityState === "hidden") flashObscure("Onglet inactif. Contenu masqué", "fenetre_quittee", 60_000);
      else setObscured(false);
    };
    const devtoolsCheck = () => {
      const gap = Math.max(window.outerWidth - window.innerWidth, window.outerHeight - window.innerHeight);
      if (gap > 200) flashObscure("Outils de développement détectés. Contenu masqué", "outils_dev", 5000);
    };
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const devInt = window.setInterval(devtoolsCheck, 1500);
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(devInt);
      document.body.style.userSelect = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the personal copy.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs: any = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const source = typeof data.pdf === "string" ? { url: data.pdf } : { data: new Uint8Array(data.pdf.slice(0)) };
      const doc = await pdfjs.getDocument(source).promise;
      if (cancelled) return;
      pdfRef.current = doc;
      setNumPages(doc.numPages);
      setPage(1);
    })();
    return () => { cancelled = true; };
  }, [data.pdf]);

  // Render the current page, with the on-screen watermark on top.
  useEffect(() => {
    if (!pdfRef.current || !canvasRef.current || numPages === 0) return;
    let cancelled = false;
    setRendering(true);
    (async () => {
      const pdf = pdfRef.current;
      const pg = await pdf.getPage(page);
      const containerWidth = Math.min(window.innerWidth - 32, 980);
      const viewport0 = pg.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = containerWidth / viewport0.width;
      const viewport = pg.getViewport({ scale: scale * ratio });
      const canvas = canvasRef.current!;
      if (cancelled) return;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / ratio}px`;
      canvas.style.height = `${viewport.height / ratio}px`;
      await pg.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled) return;
      const stamp = new Date().toLocaleString("fr-FR");
      const idLine = [data.nom_lecteur, data.email_lecteur, data.entreprise_lecteur].filter(Boolean).join(" · ");
      const text = `FIGDITIONS · ${idLine} · ${stamp}`;
      ctx.save();
      ctx.fillStyle = "rgba(232,184,75,0.16)";
      ctx.font = `bold ${22 * ratio}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-30 * Math.PI) / 180);
      const step = 140 * ratio;
      const range = Math.ceil(Math.max(canvas.width, canvas.height) / step) + 2;
      for (let i = -range; i <= range; i++) ctx.fillText(text, 0, i * step);
      ctx.restore();
      setRendering(false);
    })();
    return () => { cancelled = true; };
  }, [page, numPages, data.nom_lecteur, data.email_lecteur, data.entreprise_lecteur]);

  return (
    <div className="min-h-[100svh] flex flex-col relative bg-[#0A0704] text-white" onCopy={(e) => { e.preventDefault(); signaler("copie"); }}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#0A0704]/85 backdrop-blur">
        <Logo className="h-8 w-auto shrink-0" />
        <div className="min-w-0 text-center">
          <p className="font-wordmark-serif text-[17px] leading-tight truncate">{data.titre}</p>
          {data.auteur && <p className="text-[11px] text-[#8C7B6B] truncate">{data.auteur}</p>}
        </div>
        <span className="shrink-0 rounded-full border border-[#C8922A]/40 px-2.5 py-1 text-[11px] font-medium text-[#E8B84B]">
          Lecture {data.vue_actuelle}/{data.vue_max}
        </span>
      </header>

      <main className="flex-1 overflow-auto p-4 flex flex-col items-center gap-3">
        {rendering && <Loader2 className="h-6 w-6 animate-spin text-[#C8922A] mt-8" />}
        <canvas ref={canvasRef} className="rounded shadow-2xl bg-white select-none pointer-events-none" />

        {numPages > 0 && (
          <div className="flex items-center gap-2 mt-3 rounded-full border border-white/10 bg-white/[0.03] p-1">
            <button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[88px] text-center text-[13px] tabular-nums text-[#B8A898]">Page {page} / {numPages}</span>
            <button type="button" aria-label="Page suivante" disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>

      <footer className="px-4 py-2.5 border-t border-white/10 text-[11px] text-[#8C7B6B] flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>Exemplaire personnel de <span className="text-[#E8B84B]">{data.nom_lecteur}</span></span>
        {data.code_exemplaire && <span className="tabular-nums">Code {data.code_exemplaire}</span>}
        <span>Toute reproduction est interdite</span>
      </footer>

      {obscured && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-2xl bg-[#0A0704]/85">
          <div className="max-w-md text-center space-y-4 px-6">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C8922A]/12 text-[#E8B84B]">
              <Lock className="h-7 w-7" />
            </span>
            <p className="font-wordmark-serif text-[26px] leading-tight">{obscureReason}</p>
            <p className="text-sm text-[#B8A898]">
              Cette action a été signalée à l'éditeur avec votre nom et l'heure.
              Revenez sur la fenêtre pour reprendre la lecture.
            </p>
            <p className="text-xs text-[#E8B84B]">
              {data.nom_lecteur}{data.code_exemplaire ? ` · ${data.code_exemplaire}` : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
