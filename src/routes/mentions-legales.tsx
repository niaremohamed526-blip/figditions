import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, Section } from "@/components/legal-shell";

const OG_IMAGE = "https://figditions.xyz/assets/og-figditions.png";
const DESC =
  "Mentions légales de FIGDITIONS : éditeur du site, informations juridiques, responsable de la publication, contact et hébergeurs.";

export const Route = createFileRoute("/mentions-legales")({
  component: LegalNoticePage,
  head: () => ({
    meta: [
      { title: "Mentions Légales — FIGDITIONS" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Mentions Légales — FIGDITIONS" },
      { property: "og:description", content: DESC },
      { name: "twitter:title", content: "Mentions Légales — FIGDITIONS" },
      { name: "twitter:description", content: DESC },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
      { property: "og:url", content: "https://figditions.xyz/mentions-legales" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/mentions-legales" }],
  }),
});

const toc = [
  { id: "editeur", label: "1. Éditeur du site" },
  { id: "publication", label: "2. Publication" },
  { id: "hebergeurs", label: "3. Hébergeurs" },
];

const rows: { label: string; value: string }[] = [
  { label: "Éditeur du site", value: "FIGDITIONS" },
  { label: "Forme juridique", value: "[À COMPLÉTER]" },
  { label: "Numéro RCCM", value: "[À COMPLÉTER]" },
  { label: "Numéro d'Identification Fiscale (NIF)", value: "[À COMPLÉTER]" },
  { label: "Siège social", value: "Bamako, Mali" },
  { label: "Responsable de la publication", value: "[À COMPLÉTER]" },
];

function LegalNoticePage() {
  return (
    <LegalShell title="Mentions Légales" toc={toc}>
      <Section id="editeur" title="1. Éditeur du site">
        <dl className="space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="font-semibold text-foreground sm:min-w-[280px]">{r.label} :</dt>
              <dd className="text-muted-foreground">{r.value}</dd>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row sm:gap-3">
            <dt className="font-semibold text-foreground sm:min-w-[280px]">Contact :</dt>
            <dd className="text-muted-foreground">
              <a href="mailto:contact@figditions.xyz" className="text-primary hover:underline">
                contact@figditions.xyz
              </a>
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="publication" title="2. Publication">
        <p>
          Responsable de la publication : [À COMPLÉTER]. Pour toute question relative au contenu de
          ce site, écrivez à{" "}
          <a href="mailto:contact@figditions.xyz" className="text-primary hover:underline">
            contact@figditions.xyz
          </a>
          .
        </p>
      </Section>

      <Section id="hebergeurs" title="3. Hébergeurs">
        <ul className="list-disc pl-5 space-y-1">
          <li>Vercel Inc.</li>
          <li>Lovable Cloud (Supabase)</li>
        </ul>
      </Section>
    </LegalShell>
  );
}
