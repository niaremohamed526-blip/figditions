import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export interface TocItem { id: string; label: string }

export function LegalShell({
  title,
  subtitle,
  toc,
  children,
  showPrint = true,
}: {
  title: string;
  subtitle: string;
  toc: TocItem[];
  children: ReactNode;
  showPrint?: boolean;
}) {
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? "");

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    toc.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [toc]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid lg:grid-cols-[260px_1fr] gap-10">
          <aside className="hidden lg:block print:hidden">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Sommaire
              </p>
              {toc.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "block text-sm py-1.5 px-3 rounded-md border-l-2 transition-colors",
                    activeId === t.id
                      ? "border-primary text-primary bg-primary/5 font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </a>
              ))}
              {showPrint && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 w-full"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4 mr-2" /> Imprimer
                </Button>
              )}
            </div>
          </aside>

          <article className="min-w-0">
            <div className="mb-10">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
              {showPrint && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 lg:hidden print:hidden"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4 mr-2" /> Imprimer
                </Button>
              )}
            </div>
            <div className="prose-legal space-y-10 leading-relaxed text-[15px]">
              {children}
            </div>
            <div className="mt-16 pt-8 border-t border-border text-xs text-muted-foreground print:hidden">
              <Link to="/" className="hover:text-primary">← Retour à l'accueil</Link>
            </div>
          </article>
        </div>
      </div>

      <style>{`
        .prose-legal h2 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; scroll-margin-top: 6rem; }
        .prose-legal h3 { font-size: 1.05rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .prose-legal p { color: hsl(var(--muted-foreground)); line-height: 1.75; }
        .prose-legal ul { list-style: disc; padding-left: 1.25rem; color: hsl(var(--muted-foreground)); line-height: 1.75; }
        .prose-legal ul ul { list-style: circle; }
        .prose-legal table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
        .prose-legal th, .prose-legal td { border: 1px solid hsl(var(--border)); padding: 0.6rem 0.8rem; text-align: left; }
        .prose-legal th { background: hsl(var(--card)); font-weight: 600; color: hsl(var(--foreground)); }
        .prose-legal a { color: hsl(var(--primary)); text-decoration: underline; }
        @media print {
          body { background: white !important; color: black !important; }
          .prose-legal p, .prose-legal ul { color: #333 !important; }
        }
      `}</style>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2>{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
