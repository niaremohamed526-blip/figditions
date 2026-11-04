import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, Section } from "@/components/legal-shell";

export const Route = createFileRoute("/politique-de-confidentialite")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Politique de Confidentialité | FIGDITIONS" },
      { name: "description", content: "Politique de confidentialité de FIGDITIONS : données collectées, prestataires, sécurité et droits des utilisateurs." },
      { property: "og:title", content: "Politique de Confidentialité | FIGDITIONS" },
      { property: "og:description", content: "Politique de confidentialité de FIGDITIONS : données collectées, prestataires, sécurité et droits des utilisateurs." },
      { name: "twitter:title", content: "Politique de Confidentialité | FIGDITIONS" },
      { name: "twitter:description", content: "Politique de confidentialité de FIGDITIONS : données collectées, prestataires, sécurité et droits des utilisateurs." },
      { property: "og:image", content: "https://figditions.xyz/assets/og-figditions.jpg" },
      { name: "twitter:image", content: "https://figditions.xyz/assets/og-figditions.jpg" },
      { property: "og:url", content: "https://figditions.xyz/politique-de-confidentialite" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://figditions.xyz/politique-de-confidentialite" }],
  }),
});

const toc = [
  { id: "qui", label: "1. Qui sommes-nous ?" },
  { id: "donnees", label: "2. Données collectées" },
  { id: "usage", label: "3. Utilisation" },
  { id: "base-legale", label: "4. Base légale" },
  { id: "stockage", label: "5. Stockage & hébergement" },
  { id: "sous-traitants", label: "6. Prestataires" },
  { id: "securite", label: "7. Sécurité" },
  { id: "conservation", label: "8. Durée de conservation" },
  { id: "droits", label: "9. Vos droits" },
  { id: "cookies", label: "10. Cookies & stockage local" },
  { id: "notifications", label: "11. Notifications push" },
  { id: "ia", label: "12. Intelligence artificielle" },
  { id: "contact", label: "13. Contact & réclamations" },
  { id: "modifs", label: "14. Modifications" },
];

function PrivacyPage() {
  return (
    <LegalShell
      title="Politique de Confidentialité"
      subtitle="Dernière mise à jour : novembre 2026"
      toc={toc}
    >
      <Section id="qui" title="1. Qui sommes-nous ?">
        <p>
          FIGDITIONS est une plateforme SaaS de gestion éditoriale éditée et exploitée
          par FIGDITIONS (entreprise en cours d'immatriculation). Le présent document
          décrit les pratiques réellement en vigueur sur la plateforme et est maintenu
          par l'éditeur du service.
        </p>
        <p>Contact : <a href="mailto:figditions@gmail.com">figditions@gmail.com</a></p>
      </Section>

      <Section id="donnees" title="2. Données collectées">
        <h3>Données de compte</h3>
        <ul>
          <li>Nom, prénom, adresse email, mot de passe (haché côté fournisseur d'authentification)</li>
          
        </ul>
        <h3>Données de la maison d'édition</h3>
        <ul>
          <li>Nom, adresse, ville, téléphone, logo, cachet, coordonnées bancaires et fiscales (NIF, RCCM), nom, qualité et NINA du représentant légal (utilisés pour générer contrats, factures et bordereaux)</li>
          <li>Rôles et invitations des membres de l'équipe</li>
        </ul>
        <h3>Données éditoriales</h3>
        <ul>
          <li>Manuscrits (PDF, DOCX, TXT), couvertures, métadonnées (titre, auteur, ISBN, etc.)</li>
          <li>Contrats d'édition, auteurs et leurs coordonnées (téléphone, email, numéro Mobile Money), taux de commission et droits d'auteur</li>
          <li>Stocks, ventes, bordereaux, historique financier</li>
          <li>Liens de partage sécurisé et journal d'accès associé, y compris le nom saisi par chaque lecteur</li>
        </ul>
        <h3>Utilisation de Pr. MEDMO (assistant IA)</h3>
        <ul>
          <li>Vos questions, les réponses et l'historique de vos conversations</li>
          <li>Les photos (par exemple d'un cahier de ventes) et documents que vous joignez</li>
          <li>Un compteur de questions par mois (date, membre, type d'usage), pour appliquer le quota de votre plan</li><li>Les corrections de noms de livres et de librairies que vous validez, pour mieux reconnaître vos prochaines saisies</li>
        </ul>
        <h3>Données techniques</h3>
        <ul>
          <li>Adresse IP, type d'appareil / navigateur, journaux de connexion et d'activité</li>
          <li>Journaux techniques nécessaires à la sécurité et au bon fonctionnement du service</li>
        </ul>
        <h3>Données de paiement</h3>
        <ul>
          <li>Les paiements par QR code (Orange Money Mali et Wave Mali) sont validés manuellement par FIGDITIONS après réception de la transaction. Nous recevons la référence de paiement, le plan choisi, la période et le montant, mais <strong>aucun</strong> mot de passe, code PIN ou numéro de compte financier.</li>
          <li>Quel que soit le mode de paiement, nous ne stockons que le statut de la transaction, l'identifiant ou la référence de paiement, et les détails de l'abonnement associé.</li>
        </ul>
      </Section>

      <Section id="usage" title="3. Comment nous utilisons vos données">
        <ul>
          <li>Fournir et exploiter les fonctionnalités de la plateforme (manuscrits, stocks, ventes, contrats, partage, conversions)</li>
          <li>Gérer votre compte, votre abonnement et les membres de votre équipe</li>
          <li>Générer les documents demandés (contrats, bordereaux, factures, exports PDF)</li>
          <li>Envoyer les emails transactionnels (confirmation de compte, réinitialisation de mot de passe)</li>
          <li>Vous informer dans l'application : brief du jour, alertes de stock, échéances de contrats, nouveautés de la plateforme</li>
          <li>Appliquer les limites et quotas de votre plan</li>
          <li>Assurer la sécurité, prévenir la fraude et respecter nos obligations légales</li>
        </ul>
        <p>Nous n'utilisons pas vos données à des fins publicitaires et nous ne les vendons pas.</p>
      </Section>

      <Section id="base-legale" title="4. Base légale du traitement">
        <ul>
          <li><strong>Exécution du contrat</strong> : fournir le service souscrit</li>
          <li><strong>Consentement</strong> : notifications push, que vous pouvez désactiver à tout moment</li>
          <li><strong>Intérêt légitime</strong> : sécurité de la plateforme, prévention des abus</li>
          <li><strong>Obligation légale</strong> : conservation comptable et fiscale</li>
        </ul>
      </Section>

      <Section id="stockage" title="5. Où sont stockées vos données ?">
        <p>
          L'infrastructure applicative (base de données, authentification, stockage de fichiers)
          est fournie par Supabase. Les serveurs applicatifs (rendu des pages, fonctions serveur)
          sont hébergés sur Vercel. Les paiements par QR code (Orange Money / Wave) sont
          traités directement par FIGDITIONS, qui valide la transaction avant activation de
          l'abonnement.
        </p>
        <table>
          <thead>
            <tr><th>Type de données</th><th>Fournisseur</th><th>Rôle</th></tr>
          </thead>
          <tbody>
            <tr><td>Base de données, comptes, contenu applicatif</td><td>Supabase</td><td>Hébergement et stockage</td></tr>
            <tr><td>Manuscrits, couvertures, exports (EPUB/MOBI), logos</td><td>Supabase Storage</td><td>Stockage de fichiers</td></tr>
            <tr><td>Rendu du site et fonctions serveur</td><td>Vercel</td><td>Hébergement front / edge</td></tr>
            <tr><td>Paiements manuels par QR code</td><td>FIGDITIONS (validation manuelle des paiements Orange Money / Wave)</td><td>Validation et activation d'abonnement</td></tr>
            <tr><td>Conversion PDF → EPUB/MOBI</td><td>CloudConvert</td><td>Conversion de fichiers</td></tr>
            <tr><td>Emails transactionnels</td><td>Service email de Supabase</td><td>Envoi d'emails</td></tr>
            <tr><td>Notifications push installées (PWA)</td><td>Service de notification de votre navigateur (Google, Apple, Mozilla ou Microsoft selon l'appareil)</td><td>Notifications hors application</td></tr>
            <tr><td>Pr. MEDMO et import de contrats par IA</td><td>Google (API Gemini)</td><td>Fonctionnalités IA</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="sous-traitants" title="6. Prestataires">
        <p>
          Chaque prestataire listé plus haut traite uniquement les données strictement
          nécessaires à la prestation qui lui est confiée. Ils sont soumis à leurs propres
          engagements de sécurité et de confidentialité.
        </p>
        <ul>
          <li><strong>Supabase :</strong> base de données, authentification, stockage de fichiers et service email</li>
          <li><strong>Vercel :</strong> hébergement du site et des fonctions serveur</li>
          <li><strong>Orange Money Mali / Wave Mali :</strong> traitement des paiements manuels par QR code, validés par FIGDITIONS</li>
          <li><strong>CloudConvert :</strong> conversion de manuscrits ; le fichier source est transmis via une URL signée temporaire et supprimé côté CloudConvert selon leur politique de rétention</li>
          <li><strong>Google (API Gemini) :</strong> traitement des questions, photos et documents envoyés à Pr. MEDMO, uniquement lorsque vous l'utilisez</li>
          <li><strong>Services de notification des navigateurs :</strong> acheminement des notifications push si vous les avez activées</li>
          
        </ul>
      </Section>

      <Section id="securite" title="7. Sécurité">
        <p>Mesures techniques et organisationnelles mises en œuvre :</p>
        <ul>
          <li>Chiffrement des données en transit (HTTPS / TLS)</li>
          <li>Chiffrement au repos fourni par l'infrastructure Supabase</li>
          <li>Sécurité au niveau des lignes (RLS) : chaque maison d'édition n'accède qu'à ses propres données</li>
          <li>Contrôle d'accès basé sur les rôles pour les membres de l'équipe</li>
          <li>Liens de partage sécurisé signés, avec journal d'accès, filigrane nominatif, mesures dissuasives contre la capture et flou lorsque la page perd le focus</li>
          <li>Les données gardées pour le mode hors connexion sont effacées de l'appareil à la déconnexion</li>
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
          Quel que soit votre pays, vous disposez des droits suivants sur vos données personnelles, dans l'esprit du RGPD européen et de la législation malienne sur la protection des
          données personnelles :
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
          Pour exercer ces droits : <a href="mailto:figditions@gmail.com">figditions@gmail.com</a>.
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
          <li>IndexedDB et cache du Service Worker pour le mode sans connexion de la PWA</li>
          <li>Préférences enregistrées sur votre appareil : thème clair ou sombre, brief du jour déjà consulté</li>
          <li>Aucun cookie marketing, aucun pixel publicitaire</li>
        </ul>
      </Section>

      <Section id="notifications" title="11. Notifications push">
        <p>
          Si vous installez FIGDITIONS en tant qu'application (PWA) et que vous acceptez les
          notifications, votre navigateur enregistre un identifiant technique (push token)
          sur votre appareil. Cet identifiant permet d'envoyer des notifications même lorsque
          l'application n'est pas ouverte. Vous pouvez révoquer cette autorisation à tout moment
          dans les paramètres de votre appareil ou navigateur.
        </p>
      </Section>

      <Section id="ia" title="12. Intelligence artificielle">
        <p>
          Pr. MEDMO et l'import de contrats s'appuient sur l'API Gemini de Google. Ils ne
          fonctionnent que lorsque vous les utilisez : votre question, les données de votre
          maison nécessaires pour y répondre, et les photos ou documents que vous joignez sont
          alors transmis à Google pour produire la réponse. Pr. MEDMO n'enregistre rien dans
          vos données sans votre confirmation.
        </p>
        <p>
          Lorsque l'offre gratuite de l'API Gemini est utilisée, Google peut se servir des
          contenus reçus pour améliorer ses services, selon ses propres conditions. Évitez
          d'envoyer à Pr. MEDMO des informations dont vous ne souhaitez pas la transmission.
          Les réponses générées doivent être relues et validées avant toute utilisation
          contractuelle ou commerciale.
        </p>
      </Section>

      <Section id="contact" title="13. Contact et réclamations">
        <p>Pour toute question relative à cette politique :</p>
        <ul>
          <li>Email : <a href="mailto:figditions@gmail.com">figditions@gmail.com</a></li>
          <li>Adresse : Bamako, Mali</li>
        </ul>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l'Autorité de Protection des Données à caractère Personnel (APDP) du Mali.
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
