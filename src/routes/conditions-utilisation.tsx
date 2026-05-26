import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, Section } from "@/components/legal-shell";

export const Route = createFileRoute("/conditions-utilisation")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Conditions Générales d'Utilisation — FIGDITIONS" },
      { name: "description", content: "Conditions générales d'utilisation de la plateforme FIGDITIONS." },
      { property: "og:title", content: "Conditions d'Utilisation — FIGDITIONS" },
      { property: "og:description", content: "Les règles d'utilisation de FIGDITIONS, plans, responsabilités et droit applicable." },
    ],
  }),
});

const toc = [
  { id: "acceptation", label: "1. Acceptation" },
  { id: "description", label: "2. Description du service" },
  { id: "plans", label: "3. Plans & abonnements" },
  { id: "propriete", label: "4. Propriété des données" },
  { id: "responsabilites", label: "5. Responsabilités" },
  { id: "limitation", label: "6. Limitation de responsabilité" },
  { id: "droit", label: "7. Droit applicable" },
  { id: "contact", label: "8. Contact" },
];

function TermsPage() {
  return (
    <LegalShell
      title="Conditions Générales d'Utilisation"
      subtitle="Dernière mise à jour : Mai 2026"
      toc={toc}
    >
      <Section id="acceptation" title="1. Acceptation">
        <p>
          En utilisant FIGDITIONS, vous acceptez les présentes conditions d'utilisation.
          Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.
        </p>
      </Section>

      <Section id="description" title="2. Description du service">
        <p>
          FIGDITIONS est une plateforme SaaS de gestion éditoriale permettant aux maisons
          d'édition de gérer leurs manuscrits, auteurs, stocks, contrats et finances depuis
          un tableau de bord unifié.
        </p>
      </Section>

      <Section id="plans" title="3. Plans et abonnements">
        <table>
          <thead>
            <tr><th>Plan</th><th>Prix</th><th>Utilisateurs</th><th>Manuscrits</th></tr>
          </thead>
          <tbody>
            <tr><td>Starter</td><td>Gratuit</td><td>1</td><td>5 max</td></tr>
            <tr><td>Pro</td><td>20 000 FCFA / mois</td><td>3</td><td>Illimité</td></tr>
            <tr><td>Business</td><td>50 000 FCFA / mois</td><td>Illimité</td><td>Illimité</td></tr>
          </tbody>
        </table>
        <p>
          Les abonnements sont renouvelés automatiquement. Vous pouvez annuler à tout moment
          depuis vos paramètres. Aucun remboursement n'est effectué pour les périodes entamées.
        </p>
      </Section>

      <Section id="propriete" title="4. Propriété des données">
        <p>
          Vous conservez l'intégralité des droits sur vos données et manuscrits uploadés sur
          FIGDITIONS. Nous ne revendiquons aucun droit de propriété intellectuelle sur vos contenus.
        </p>
      </Section>

      <Section id="responsabilites" title="5. Responsabilités">
        <h3>FIGDITIONS s'engage à :</h3>
        <ul>
          <li>✅ Maintenir une disponibilité de 99,5%</li>
          <li>✅ Sauvegarder vos données quotidiennement</li>
          <li>✅ Notifier en cas d'incident sous 24h</li>
          <li>✅ Protéger la confidentialité de vos données</li>
        </ul>
        <h3>L'utilisateur s'engage à :</h3>
        <ul>
          <li>✅ Ne pas uploader de contenu illégal</li>
          <li>✅ Ne pas tenter de pirater la plateforme</li>
          <li>✅ Maintenir la confidentialité de son mot de passe</li>
          <li>✅ Utiliser la plateforme conformément aux lois maliennes et internationales</li>
        </ul>
      </Section>

      <Section id="limitation" title="6. Limitation de responsabilité">
        <p>
          FIGDITIONS ne peut être tenu responsable des pertes commerciales résultant d'une
          interruption de service ou d'une perte de données au-delà de ce qui est couvert
          par nos sauvegardes.
        </p>
      </Section>

      <Section id="droit" title="7. Droit applicable">
        <p>
          Les présentes conditions sont régies par le droit malien et les dispositions de
          l'OHADA. Tout litige sera soumis aux tribunaux compétents de Bamako, Mali.
        </p>
      </Section>

      <Section id="contact" title="8. Contact">
        <ul>
          <li>Email : <a href="mailto:Figditions@gmail.com">Figditions@gmail.com</a></li>
          <li>Adresse : Bamako, Mali</li>
        </ul>
      </Section>
    </LegalShell>
  );
}
