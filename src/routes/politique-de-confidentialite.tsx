import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, Section } from "@/components/legal-shell";

export const Route = createFileRoute("/politique-de-confidentialite")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Politique de Confidentialité — FIGDITIONS" },
      { name: "description", content: "Politique de confidentialité de FIGDITIONS : données collectées, sous-traitants, sécurité, RGPD/OHADA et droits des utilisateurs." },
      { property: "og:title", content: "Politique de Confidentialité — FIGDITIONS" },
      { property: "og:description", content: "Comment FIGDITIONS protège vos données personnelles et éditoriales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const toc = [
  { id: "qui", label: "1. Qui sommes-nous ?" },
  { id: "donnees", label: "2. Données collectées" },
  { id: "usage", label: "3. Utilisation" },
  { id: "base-legale", label: "4. Base légale" },
  { id: "stockage", label: "5. Stockage & hébergement" },
  { id: "sous-traitants", label: "6. Sous-traitants" },
  { id: "securite", label: "7. Sécurité & sauvegardes" },
  { id: "conservation", label: "8. Durée de conservation" },
  { id: "droits", label: "9. Vos droits" },
  { id: "cookies", label: "10. Cookies & stockage local" },
  { id: "notifications", label: "11. Notifications push" },
  { id: "ia", label: "12. Intelligence artificielle" },
  { id: "ohada", label: "13. Conformité OHADA" },
  { id: "contact", label: "14. Contact & réclamations" },
  { id: "modifs", label: "15. Modifications" },
];

function PrivacyPage() {
  return (
    <LegalShell
      title="Politique de Confidentialité"
      subtitle="Dernière mise à jour : Août 2026"
      toc={toc}
    >
      <Section id="qui" title="1. Qui sommes-nous ?">
        <p>
          FIGDITIONS est une plateforme SaaS de gestion éditoriale éditée et exploitée
          par FIGDITIONS, dont le siège est situé à Bamako, Mali. Le présent document
          décrit les pratiques réellement en vigueur sur la plateforme et est maintenu
          par l'éditeur du service.
        </p>
        <p>Contact : <a href="mailto:Figditions@gmail.com">Figditions@gmail.com</a></p>
      </Section>

      <Section id="donnees" title="2. Données collectées">
        <h3>Données de compte</h3>
        <ul>
          <li>Nom, prénom, adresse email, mot de passe (haché côté fournisseur d'authentification)</li>
          <li>Numéro de téléphone (facultatif), photo de profil (facultatif)</li>
          <li>En cas de connexion Google : identifiant Google, nom et email fournis par Google</li>
        </ul>
        <h3>Données de la maison d'édition</h3>
        <ul>
          <li>Nom, adresse, ville, logo, coordonnées bancaires et fiscales (utilisées pour la génération de contrats et bordereaux)</li>
          <li>Rôles et invitations des membres de l'équipe</li>
        </ul>
        <h3>Données éditoriales</h3>
        <ul>
          <li>Manuscrits (PDF, DOCX, TXT), couvertures, métadonnées (titre, auteur, ISBN, etc.)</li>
          <li>Contrats d'édition, auteurs, ayants droit, taux de commission et royalties</li>
          <li>Stocks, ventes, bordereaux, historique financier</li>
          <li>Liens de partage sécurisé et journal d'accès associé</li>
        </ul>
        <h3>Données techniques</h3>
        <ul>
          <li>Adresse IP, type d'appareil / navigateur, journaux de connexion et d'activité</li>
          <li>Journaux techniques nécessaires à la sécurité et au bon fonctionnement du service</li>
        </ul>
        <h3>Données de paiement</h3>
        <ul>
          <li>Les paiements par carte bancaire et mobile-money automatiques sont traités par Flutterwave. FIGDITIONS ne stocke <strong>aucune</strong> donnée de carte bancaire.</li>
          <li>Les paiements manuels par QR code (Orange Money Mali et Wave Mali) sont validés manuellement par FIGDITIONS après réception de la transaction. Nous recevons la référence de paiement, le plan choisi, la période et le montant, mais <strong>aucun</strong> mot de passe, code PIN ou numéro de compte financier.</li>
          <li>Quel que soit le mode de paiement, nous ne stockons que le statut de la transaction, l'identifiant ou la référence de paiement, et les détails de l'abonnement associé.</li>
        </ul>
      </Section>

      <Section id="usage" title="3. Comment nous utilisons vos données">
        <ul>
          <li>Fournir et exploiter les fonctionnalités de la plateforme (manuscrits, stocks, ventes, contrats, partage, conversions)</li>
          <li>Gérer votre compte, votre abonnement et les membres de votre équipe</li>
          <li>Générer les documents demandés (contrats, bordereaux, factures, exports PDF)</li>
          <li>Envoyer les emails transactionnels (invitations, notifications importantes, réinitialisation de mot de passe)</li>
          <li>Assurer la sécurité, prévenir la fraude et respecter nos obligations légales</li>
        </ul>
        <p>Nous n'utilisons pas vos données à des fins publicitaires et nous ne les vendons pas.</p>
      </Section>

      <Section id="base-legale" title="4. Base légale du traitement">
        <ul>
          <li><strong>Exécution du contrat</strong> : fournir le service souscrit</li>
          <li><strong>Consentement</strong> : connexion via Google, envoi d'emails non essentiels</li>
          <li><strong>Intérêt légitime</strong> : sécurité de la plateforme, prévention des abus</li>
          <li><strong>Obligation légale</strong> : conservation comptable et fiscale</li>
        </ul>
      </Section>

      <Section id="stockage" title="5. Où sont stockées vos données ?">
        <p>
          L'infrastructure applicative (base de données, authentification, stockage de fichiers)
          est fournie par Lovable Cloud, qui s'appuie sur Supabase. Les serveurs applicatifs
          (SSR, fonctions serveur) sont hébergés sur Vercel. Les paiements automatiques sont
          opérés par Flutterwave ; les paiements manuels par QR code (Orange Money / Wave) sont
          traités directement par FIGDITIONS, qui valide la transaction avant activation de
          l'abonnement.
        </p>
        <table>
          <thead>
            <tr><th>Type de données</th><th>Fournisseur</th><th>Rôle</th></tr>
          </thead>
          <tbody>
            <tr><td>Base de données, comptes, contenu applicatif</td><td>Lovable Cloud (Supabase)</td><td>Hébergement et stockage</td></tr>
            <tr><td>Manuscrits, couvertures, exports (EPUB/MOBI), logos</td><td>Lovable Cloud Storage (Supabase Storage)</td><td>Stockage de fichiers</td></tr>
            <tr><td>Rendu du site et fonctions serveur</td><td>Vercel</td><td>Hébergement front / edge</td></tr>
            <tr><td>Paiements automatiques (carte, mobile money)</td><td>Flutterwave</td><td>Traitement des paiements</td></tr>
            <tr><td>Paiements manuels par QR code</td><td>FIGDITIONS (validation manuelle des paiements Orange Money / Wave)</td><td>Validation et activation d'abonnement</td></tr>
            <tr><td>Conversion PDF → EPUB/MOBI</td><td>CloudConvert</td><td>Conversion de fichiers</td></tr>
            <tr><td>Emails transactionnels</td><td>Service email par défaut de Supabase</td><td>Envoi d'emails</td></tr>
            <tr><td>Notifications push installées (PWA)</td><td>Navigateur / Service Worker de l'appareil, avec Lovable Cloud pour le routage côté serveur</td><td>Notifications hors application</td></tr>
            <tr><td>Assistant / génération IA</td><td>Google Gemini via Lovable AI Gateway</td><td>Fonctionnalités IA</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="sous-traitants" title="6. Sous-traitants">
        <p>
          Chaque sous-traitant listé ci-dessus traite uniquement les données strictement
          nécessaires à la prestation qui lui est confiée. Ils sont soumis à leurs propres
          engagements de sécurité et de confidentialité.
        </p>
        <ul>
          <li><strong>Lovable Cloud / Supabase</strong> — base de données, authentification, stockage, service email et routage des notifications serveur</li>
          <li><strong>Vercel</strong> — hébergement du site et des fonctions serveur</li>
          <li><strong>Flutterwave</strong> — paiements automatiques par carte et mobile money</li>
          <li><strong>Orange Money Mali / Wave Mali</strong> — traitement des paiements manuels par QR code, validés par FIGDITIONS</li>
          <li><strong>CloudConvert</strong> — conversion de manuscrits ; le fichier source est transmis via une URL signée temporaire et supprimé côté CloudConvert selon leur politique de rétention</li>
          <li><strong>Google Gemini (via Lovable AI Gateway)</strong> — génération assistée par IA lorsque vous utilisez explicitement ces fonctionnalités</li>
          <li><strong>Google</strong> — uniquement si vous choisissez la connexion Google (OAuth)</li>
          <li><strong>Figuira Éditions</strong> — partenaire officiel, uniquement pour les fonctionnalités contractuellement partagées avec votre autorisation</li>
        </ul>
      </Section>

      <Section id="securite" title="7. Sécurité et sauvegardes">
        <p>Mesures techniques et organisationnelles mises en œuvre :</p>
        <ul>
          <li>Chiffrement des données en transit (HTTPS / TLS)</li>
          <li>Chiffrement au repos fourni par l'infrastructure Supabase</li>
          <li>Sauvegardes automatiques de la base de données assurées par le fournisseur</li>
          <li>Row Level Security (RLS) — chaque maison d'édition n'accède qu'à ses propres données</li>
          <li>Contrôle d'accès basé sur les rôles pour les membres de l'équipe</li>
          <li>Liens de partage sécurisé signés, avec journal d'accès et protection anti-capture (filigrane, flou hors-focus)</li>
          <li>Application PWA installable avec cache local chiffré par le navigateur</li>
          <li>Le personnel de FIGDITIONS n'accède pas au contenu de vos manuscrits sans motif légitime ou autorisation explicite</li>
        </ul>
        <p>
          Aucune plateforme ne peut garantir une sécurité absolue ; nous nous engageons à
          notifier tout incident de sécurité affectant vos données dans les meilleurs délais.
        </p>
      </Section>

      <Section id="conservation" title="8. Durée de conservation">
        <ul>
          <li><strong>Données de compte</strong> : tant que le compte est actif, puis supprimées sur demande</li>
          <li><strong>Manuscrits et fichiers</strong> : jusqu'à suppression par l'utilisateur ou fermeture du compte</li>
          <li><strong>Données comptables (factures, bordereaux, contrats)</strong> : durée légale de conservation applicable</li>
          <li><strong>Journaux techniques</strong> : durée limitée nécessaire à la sécurité</li>
          <li><strong>Fichiers de conversion CloudConvert</strong> : supprimés côté CloudConvert selon leur politique (généralement 24 h)</li>
        </ul>
      </Section>

      <Section id="droits" title="9. Vos droits (RGPD & loi malienne)">
        <p>
          Conformément au RGPD européen et à la législation malienne sur la protection des
          données personnelles, vous disposez des droits suivants :
        </p>
        <ul>
          <li><strong>Accès</strong> : obtenir une copie de vos données</li>
          <li><strong>Rectification</strong> : corriger vos données</li>
          <li><strong>Effacement</strong> : supprimer votre compte et vos données</li>
          <li><strong>Portabilité</strong> : exporter vos données dans un format lisible</li>
          <li><strong>Opposition et limitation</strong> : refuser ou limiter certains traitements</li>
          <li><strong>Retrait du consentement</strong> à tout moment</li>
        </ul>
        <p>
          Pour exercer ces droits : <a href="mailto:Figditions@gmail.com">Figditions@gmail.com</a>.
          Délai de réponse : 30 jours maximum.
        </p>
      </Section>

      <Section id="cookies" title="10. Cookies et stockage local">
        <p>
          FIGDITIONS n'utilise pas de cookies publicitaires ni de traqueurs tiers. Nous
          utilisons uniquement :
        </p>
        <ul>
          <li>Cookies / stockage locaux techniques essentiels à l'authentification et à la session</li>
          <li>IndexedDB et cache du Service Worker pour le mode hors-ligne de la PWA</li>
          <li>Aucun cookie marketing, aucun pixel publicitaire</li>
        </ul>
      </Section>

      <Section id="ia" title="11. Intelligence artificielle">
        <p>
          Certaines fonctionnalités s'appuient sur Google Gemini via le Lovable AI Gateway.
          Elles ne sont exécutées que lorsque vous les déclenchez explicitement. Les données
          envoyées se limitent au contenu strictement nécessaire à la requête. Les résultats
          générés doivent être relus et validés avant toute utilisation contractuelle ou
          commerciale.
        </p>
      </Section>

      <Section id="ohada" title="12. Conformité OHADA">
        <p>
          En tant que plateforme opérant en zone OHADA, FIGDITIONS respecte les dispositions
          de l'Acte Uniforme OHADA relatif au droit commercial général concernant la
          confidentialité des contrats d'édition et des données commerciales.
        </p>
      </Section>

      <Section id="contact" title="13. Contact et réclamations">
        <p>Pour toute question relative à cette politique :</p>
        <ul>
          <li>Email : <a href="mailto:Figditions@gmail.com">Figditions@gmail.com</a></li>
          <li>Adresse : Bamako, Mali</li>
        </ul>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l'autorité
          de protection des données personnelles compétente.
        </p>
      </Section>

      <Section id="modifs" title="14. Modifications">
        <p>
          Nous nous réservons le droit de modifier cette politique. En cas de changement
          important, vous serez notifié par email et/ou via l'application. La version en
          vigueur est toujours disponible sur cette page.
        </p>
      </Section>
    </LegalShell>
  );
}
