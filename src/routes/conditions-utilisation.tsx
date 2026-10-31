import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, Section } from "@/components/legal-shell";
import { PLANS } from "@/config/plans";
import { fcfa } from "@/lib/format";

export const Route = createFileRoute("/conditions-utilisation")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Conditions Générales d'Utilisation | FIGDITIONS" },
      { name: "description", content: "Conditions générales d'utilisation de FIGDITIONS : plans, responsabilités, propriété des contenus, IA, paiements et droit applicable." },
      { property: "og:title", content: "Conditions d'Utilisation | FIGDITIONS" },
      { property: "og:description", content: "Conditions générales d'utilisation de FIGDITIONS : plans, responsabilités, propriété des contenus, IA, paiements et droit applicable." },
      { name: "twitter:title", content: "Conditions d'Utilisation | FIGDITIONS" },
      { name: "twitter:description", content: "Conditions générales d'utilisation de FIGDITIONS : plans, responsabilités, propriété des contenus, IA, paiements et droit applicable." },
      { property: "og:image", content: "https://figditions.xyz/assets/og-figditions.png" },
      { name: "twitter:image", content: "https://figditions.xyz/assets/og-figditions.png" },
      { property: "og:url", content: "https://figditions.xyz/conditions-utilisation" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/conditions-utilisation" }],
  }),
});

const toc = [
  { id: "acceptation", label: "1. Acceptation" },
  { id: "description", label: "2. Description du service" },
  { id: "compte", label: "3. Compte & équipe" },
  { id: "plans", label: "4. Plans & abonnements" },
  { id: "paiement", label: "5. Paiement" },
  { id: "propriete", label: "6. Propriété des contenus" },
  { id: "documents", label: "7. Documents générés" },
  { id: "conversion", label: "8. Conversion & partage" },
  { id: "ia", label: "9. Fonctionnalités IA" },
  { id: "responsabilites", label: "10. Responsabilités" },
  { id: "disponibilite", label: "11. Disponibilité et prestataires" },
  { id: "limitation", label: "12. Limitation de responsabilité" },
  { id: "resiliation", label: "13. Résiliation" },
  { id: "droit", label: "14. Droit applicable" },
  { id: "contact", label: "15. Contact" },
];

function TermsPage() {
  return (
    <LegalShell
      title="Conditions Générales d'Utilisation"
      subtitle="Dernière mise à jour : Août 2026"
      toc={toc}
    >
      <Section id="acceptation" title="1. Acceptation">
        <p>
          En créant un compte ou en utilisant FIGDITIONS, vous acceptez les présentes
          conditions générales d'utilisation ainsi que la Politique de Confidentialité.
          Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le service.
        </p>
      </Section>

      <Section id="description" title="2. Description du service">
        <p>
          FIGDITIONS est une plateforme SaaS destinée aux maisons d'édition, principalement
          en zone OHADA, pour gérer manuscrits, auteurs, contrats, stocks, ventes, bordereaux,
          finances, partage sécurisé de lecture et conversion de fichiers. Elle est accessible
          via le web et installable en tant qu'application (PWA) avec un mode sans connexion et
          des notifications push optionnelles.
        </p>
      </Section>

      <Section id="compte" title="3. Compte et équipe">
        <ul>
          <li>La création de compte se fait par email et mot de passe.</li>
          <li>Chaque maison d'édition dispose d'un espace isolé par organisation avec ses propres membres et rôles.</li>
          <li>L'administrateur peut inviter des membres par email et leur attribuer un rôle. Chaque membre est responsable de la confidentialité de ses identifiants.</li>
          <li>Toute activité effectuée depuis un compte est réputée réalisée sous la responsabilité de son titulaire.</li>
        </ul>
      </Section>

      <Section id="plans" title="4. Plans et abonnements">
        <table>
          <thead>
            <tr><th>Plan</th><th>Prix</th><th>Utilisateurs</th><th>Périmètre</th></tr>
          </thead>
          <tbody>
            {PLANS.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  {p.priceMonthly === 0
                    ? "Gratuit"
                    : `${fcfa(p.priceMonthly)} par mois ou ${fcfa(p.priceYearly)} par an`}
                </td>
                <td>{p.seatsLabel}</td>
                <td>{p.tagline}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Le plan Pro inclut la conversion ePub &amp; MOBI et le partage de lecture sécurisé dans la limite de 10 liens actifs par mois. Le plan Business lève ces limites et ajoute les bordereaux avancés, le branding personnalisé et le support prioritaire 24/7.
        </p>
        <p>
          Des codes promotionnels peuvent être proposés ponctuellement. Ils sont soumis à
          leurs propres conditions (durée, plan attribué, usage unique par utilisateur).
        </p>
      </Section>

      <Section id="paiement" title="5. Paiement">
        <ul>
          <li>Les moyens de paiement acceptés sont : Orange Money Mali et Wave Mali.</li>
          <li>Les paiements manuels par QR code se font via Orange Money Mali ou Wave Mali. Vous scannez le QR affiché, effectuez le transfert, puis transmettez la référence à FIGDITIONS par WhatsApp ou email. L'activation de l'abonnement est validée manuellement par FIGDITIONS dans les meilleurs délais.</li>
          <li>Les abonnements sont facturés d'avance et doivent être renouvelés manuellement à la fin de la période choisie.</li>
          <li>Vous pouvez annuler le renouvellement à tout moment depuis vos paramètres. L'accès reste ouvert jusqu'à la fin de la période payée.</li>
          <li>Sauf disposition légale contraire, les périodes entamées ne sont pas remboursables.</li>
        </ul>
      </Section>

      <Section id="propriete" title="6. Propriété des contenus">
        <p>
          Vous conservez l'intégralité des droits sur vos manuscrits, œuvres, contrats,
          logos et données uploadés sur FIGDITIONS. Nous ne revendiquons aucun droit de
          propriété intellectuelle sur vos contenus. Vous nous accordez uniquement la
          licence technique strictement nécessaire à l'exécution du service (stockage,
          affichage à votre équipe, génération de PDF, conversion sur votre demande).
        </p>
      </Section>

      <Section id="documents" title="7. Documents générés (contrats, bordereaux, factures)">
        <p>
          FIGDITIONS fournit des modèles de contrats d'édition, bordereaux de vente et
          factures adaptés au contexte malien / OHADA. Ces documents sont fournis à titre
          d'aide et ne constituent pas un conseil juridique. Il vous appartient de les
          relire, de les faire valider si nécessaire par un professionnel et d'y faire
          apposer les signatures requises.
        </p>
      </Section>

      <Section id="conversion" title="8. Conversion et partage sécurisé">
        <ul>
          <li>La conversion de fichiers (PDF, DOCX, TXT vers EPUB / MOBI) est effectuée via CloudConvert. Le fichier source est transmis via une URL signée temporaire et n'est pas conservé au-delà de la durée nécessaire à la conversion.</li>
          <li>Le partage sécurisé génère un lien signé avec durée de validité, filigrane et protections contre la capture. Ces protections dissuasives ne peuvent garantir l'impossibilité absolue de copie sans connexion.</li>
          <li>Vous êtes responsable de la légalité des contenus que vous partagez et de la vérification des droits associés.</li>
        </ul>
      </Section>

      <Section id="ia" title="9. Fonctionnalités IA">
        <p>
          Certaines fonctionnalités utilisent Google Gemini via le Lovable AI Gateway. Les
          contenus générés par IA sont fournis « en l'état ». Vous devez les relire et les
          valider avant tout usage contractuel, commercial ou éditorial. FIGDITIONS ne
          garantit ni l'exactitude ni l'exhaustivité des sorties générées.
        </p>
      </Section>

      <Section id="responsabilites" title="10. Responsabilités">
        <h3>FIGDITIONS s'engage à :</h3>
        <ul>
          <li>Mettre en œuvre les moyens raisonnables pour assurer la disponibilité et la sécurité du service</li>
          <li>Sauvegarder régulièrement les données via l'infrastructure de son hébergeur</li>
          <li>Notifier tout incident de sécurité majeur dans les meilleurs délais</li>
          <li>Protéger la confidentialité de vos données selon la Politique de Confidentialité</li>
        </ul>
        <h3>L'utilisateur s'engage à :</h3>
        <ul>
          <li>Ne pas uploader de contenu illégal, contrefait ou pour lequel il ne détient pas les droits</li>
          <li>Ne pas tenter d'accéder à des données d'autres tenants, de contourner l'authentification, de scraper ou de surcharger la plateforme</li>
          <li>Maintenir la confidentialité de ses identifiants et de ceux de son équipe</li>
          <li>Utiliser la plateforme conformément aux lois maliennes, OHADA et internationales applicables</li>
        </ul>
      </Section>

      <Section id="disponibilite" title="11. Disponibilité et prestataires">
        <p>
          Le service repose sur des prestataires tiers (Lovable Cloud / Supabase, Vercel,
          CloudConvert, Google Gemini) et sur des services validés manuellement par
          FIGDITIONS (paiements Orange Money / Wave). Les notifications push installées
          dépendent du navigateur et du système de l'utilisateur. Une interruption de la part
          de ces fournisseurs peut entraîner une indisponibilité temporaire du service. Nous
          mettons en œuvre les moyens raisonnables pour rétablir le service dès que possible.
        </p>
      </Section>

      <Section id="limitation" title="12. Limitation de responsabilité">
        <p>
          Dans les limites autorisées par la loi applicable, FIGDITIONS ne peut être tenu
          responsable des pertes indirectes (perte de chiffre d'affaires, perte de clientèle,
          dommage à la réputation) résultant d'une interruption du service, d'une perte de
          données au-delà de nos sauvegardes, ou d'un usage non conforme de la plateforme.
          La responsabilité totale de FIGDITIONS est en tout état de cause limitée au montant
          effectivement payé par l'utilisateur au titre des 12 derniers mois d'abonnement.
        </p>
      </Section>

      <Section id="resiliation" title="13. Résiliation">
        <ul>
          <li>Vous pouvez résilier votre abonnement à tout moment depuis vos paramètres. Vos données restent accessibles jusqu'à la fin de la période payée.</li>
          <li>FIGDITIONS peut suspendre ou fermer un compte en cas de violation grave des présentes conditions (contenu illégal, tentative de piratage, fraude au paiement), après notification lorsque cela est possible.</li>
          <li>À la fermeture du compte, vous pouvez demander l'export ou la suppression de vos données conformément à la Politique de Confidentialité.</li>
        </ul>
      </Section>

      <Section id="droit" title="14. Droit applicable">
        <p>
          Les présentes conditions sont régies par le droit malien et les dispositions de
          l'OHADA. À défaut d'accord amiable, tout litige sera soumis aux tribunaux
          compétents de Bamako, Mali.
        </p>
      </Section>

      <Section id="contact" title="15. Contact">
        <ul>
          <li>Email : <a href="mailto:figditions@gmail.com">figditions@gmail.com</a></li>
          <li>Adresse : Bamako, Mali</li>
        </ul>
      </Section>
    </LegalShell>
  );
}
