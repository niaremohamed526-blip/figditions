import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Lock, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/lecture/$token")({
  component: LecturePage,
  head: () => ({ meta: [
    { title: "Lecture sécurisée — FIGDITIONS" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
});

type ShareInfo =
  | { ok: false; reason: "not_found" | "disabled" | "exhausted" | "no_file" }
  | {
      ok: true;
      share: {
        nom_lecteur: string | null;
        email_lecteur: string | null;
        entreprise_lecteur: string | null;
        nombre_vues_max: number;
        nombre_vues_actuel: number;
      };
      manuscrit: { titre: string; auteur: string };
    };

type OpenResult =
  | { ok: false; reason: "not_found" | "disabled" | "exhausted" | "no_file" | "identity_mismatch" | "rate_limited" }
  | {
      ok: true;
      pdfUrl: string;
      titre: string;
      auteur: string;
      nom_lecteur: string;
      email_lecteur?: string | null;
      entreprise_lecteur: string;
      vue_actuelle: number;
      vue_max: number;
    };


const REASONS: Record<string, string> = {
  not_found: "Ce lien n'existe pas ou a été supprimé.",
  disabled: "Ce lien a été désactivé par l'éditeur.",
  exhausted: "Vous avez atteint le nombre maximum de consultations autorisées pour ce document.",
  no_file: "Le document n'est pas encore disponible. Contactez l'éditeur.",
  identity_mismatch: "Les informations saisies ne correspondent pas au destinataire enregistré. Vérifiez votre nom (et votre email s'il vous a été demandé).",
  rate_limited: "Trop de tentatives échouées. Veuillez patienter 10 minutes avant de réessayer.",
};

// Erreurs "retryables" : on garde le formulaire et on affiche l'erreur inline
// au lieu de bloquer la page — l'utilisateur peut corriger et réessayer.
const RETRYABLE = new Set(["identity_mismatch", "rate_limited"]);

async function callLectureShare<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("lecture-share", { body: payload });
  if (error) return { ok: false, reason: "not_found" } as T;
  return data as T;
}

function LecturePage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [opened, setOpened] = useState<OpenResult | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    callLectureShare<ShareInfo>({ action: "info", token }).then(setInfo);
  }, [token]);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInlineError(null);
    const r = await callLectureShare<OpenResult>({
      action: "open",
      token,
      nom_confirme: nom,
      email_confirme: email || undefined,
    });
    setLoading(false);
    if (!r.ok && RETRYABLE.has(r.reason)) {
      setInlineError(REASONS[r.reason]);
      return;
    }
    setOpened(r);
  };

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0D0A06" }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!info.ok) return <ErrorPage reason={REASONS[info.reason]} />;
  if (opened && !opened.ok) return <ErrorPage reason={REASONS[opened.reason]} />;

  if (!opened?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0D0A06" }}>
        <form onSubmit={handleOpen} className="w-full max-w-md space-y-5">
          <div className="text-center space-y-3">
            <Logo className="h-12 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Accès au document sécurisé</h1>
            <p className="text-sm text-muted-foreground">Veuillez confirmer votre identité pour accéder au manuscrit</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="text-sm">
              <p className="font-medium">{info.manuscrit.titre}</p>
              <p className="text-muted-foreground">{info.manuscrit.auteur}</p>
            </div>
            <div className="space-y-2">
              <Label>Votre nom complet</Label>
              <Input required value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Votre email (si demandé par l'éditeur)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {inlineError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {inlineError}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accéder au document"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Vue {info.share.nombre_vues_actuel + 1} sur {info.share.nombre_vues_max}
            </p>
          </div>
        </form>
      </div>
    );
  }

  return <SecureViewer data={opened} />;
}

function ErrorPage({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0D0A06" }}>
      <div className="max-w-md text-center space-y-5">
        <Lock className="h-16 w-16 mx-auto" style={{ color: "#E8B84B" }} />
        <p className="text-white text-lg">{reason}</p>
        <Button variant="outline" onClick={() => window.history.back()}>Retour</Button>
        <div className="pt-8"><Logo className="h-8 mx-auto opacity-70" /></div>
      </div>
    </div>
  );
}

function SecureViewer({ data }: { data: Extract<OpenResult, { ok: true }> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [now, setNow] = useState(new Date());

  // Security: disable right-click, common shortcuts, devtools, selection
  useEffect(() => {
    const onCtx = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "PrintScreen") { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "c", "u"].includes(k)) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) e.preventDefault();
      if (e.key === "F12") e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("keydown", onKey);
    document.body.style.userSelect = "none";
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("keydown", onKey);
      document.body.style.userSelect = "";
      clearInterval(t);
    };
  }, []);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs: any = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const doc = await pdfjs.getDocument({ url: data.pdfUrl }).promise;
      if (cancelled) return;
      pdfRef.current = doc;
      setNumPages(doc.numPages);
      setPage(1);
    })();
    return () => { cancelled = true; };
  }, [data.pdfUrl]);

  // Render current page + watermark
  useEffect(() => {
    if (!pdfRef.current || !canvasRef.current || numPages === 0) return;
    let cancelled = false;
    setRendering(true);
    (async () => {
      const pdf = pdfRef.current;
      const pg = await pdf.getPage(page);
      const containerWidth = Math.min(window.innerWidth - 32, 980);
      const viewport0 = pg.getViewport({ scale: 1 });
      const scale = containerWidth / viewport0.width;
      const viewport = pg.getViewport({ scale });
      const canvas = canvasRef.current!;
      if (cancelled) return;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      await pg.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled) return;
      // Watermark
      const text = `Lecture exclusive — ${data.nom_lecteur}${data.entreprise_lecteur ? " · " + data.entreprise_lecteur : ""} — FIGDITIONS`;
      ctx.save();
      ctx.fillStyle = "rgba(232,184,75,0.15)";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-35 * Math.PI) / 180);
      const positions = [-canvas.height * 0.35, 0, canvas.height * 0.35];
      for (const y of positions) ctx.fillText(text, 0, y);
      ctx.restore();
      setRendering(false);
    })();
    return () => { cancelled = true; };
  }, [page, numPages, data.nom_lecteur, data.entreprise_lecteur]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0D0A06" }} onCopy={(e) => e.preventDefault()}>
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-background/80 backdrop-blur">
        <Logo className="h-7" />
        <p className="text-sm font-medium text-foreground truncate max-w-[50%] text-center">{data.titre}</p>
        <span className="text-xs font-semibold" style={{ color: "#E8B84B" }}>
          Vue {data.vue_actuelle} sur {data.vue_max}
        </span>
      </header>

      {/* PDF */}
      <main className="flex-1 overflow-auto p-4 flex flex-col items-center gap-3">
        {rendering && <Loader2 className="h-6 w-6 animate-spin text-primary mt-8" />}
        <canvas ref={canvasRef} className="rounded shadow-xl bg-white select-none pointer-events-none" />

        {numPages > 0 && (
          <div className="flex items-center gap-3 mt-3">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Précédent
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} / {numPages}</span>
            <Button size="sm" variant="outline" disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}>
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-border/60 bg-background/80 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>Document protégé par FIGDITIONS — Toute reproduction est interdite</span>
        <span>{now.toLocaleString("fr-FR")}</span>
        <span>Lecteur : {data.nom_lecteur}</span>
      </footer>
    </div>
  );
}
