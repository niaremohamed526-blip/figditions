// Shared layout for login, signup and password pages, in the homepage's editorial style.
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

const HERO = "/assets/hero-figditions.webp";

export const authInputClass =
  "w-full h-11 px-4 rounded-md bg-transparent text-white outline-none transition-colors " +
  "border border-white/15 placeholder:text-[#6B5B4E] hover:border-white/25 focus:border-[#C8922A]";

export const authButtonClass =
  "w-full h-12 inline-flex items-center justify-center rounded-md bg-[#C8922A] text-white text-[15px] font-medium " +
  "transition-colors hover:bg-[#B5821F] disabled:opacity-60";

export const authLinkClass = "text-[#E8B84B] underline decoration-[#E8B84B]/40 underline-offset-4 hover:decoration-[#E8B84B]";

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={authInputClass + " " + (props.className ?? "")} />;
}

export function AuthShell({ kicker, title, intro, children }: {
  kicker: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100svh] bg-[#0A0704] text-white lg:grid lg:grid-cols-2">
      {/* Left: the homepage photo and headline, desktop only */}
      <aside className="relative hidden lg:block lg:sticky lg:top-0 lg:h-[100svh] overflow-hidden border-r border-white/10">
        <img src={HERO} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0704] via-[#0A0704]/55 to-[#0A0704]/30" aria-hidden="true" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link to="/" aria-label="FIGDITIONS, accueil" className="inline-block w-fit">
            <Logo className="h-14 w-auto" />
          </Link>
          <div className="max-w-md">
            <p className="font-wordmark-serif text-[44px] leading-[1.02] text-white">
              Votre maison d'édition, <em className="italic text-[#E8B84B]">enfin sous contrôle.</em>
            </p>
            <p className="mt-5 text-[15px] leading-relaxed text-[#B8A898]">
              Manuscrits, stocks en librairie, ventes et droits d'auteur au même endroit.
            </p>
          </div>
        </div>
      </aside>

      {/* Right: the form */}
      <main className="flex min-h-[100svh] flex-col px-6 py-10 sm:px-12">
        <Link to="/" aria-label="FIGDITIONS, accueil" className="inline-block w-fit lg:hidden">
          <Logo className="h-12 w-auto" />
        </Link>
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-[420px] py-10">
            <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-[#8C7B6B]">
              <span className="h-px w-8 bg-[#C8922A]" aria-hidden="true" />
              {kicker}
            </p>
            <h1 className="mt-5 font-wordmark-serif !font-normal text-white text-[40px] sm:text-[48px] leading-[1.02] !tracking-[-0.01em]">
              {title}
            </h1>
            {intro && <p className="mt-4 text-[15px] leading-relaxed text-[#B8A898]">{intro}</p>}
            <div className="mt-9">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
