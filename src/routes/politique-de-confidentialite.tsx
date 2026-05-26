import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, Section } from "@/components/legal-shell";

export const Route = createFileRoute("/politique-de-confidentialite")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Politique de Confidentialité — FIGDITIONS" },
      { name: "description", content: "Politique de confidentialité de FIGDITIONS : données collectées, stockage, sécurité, RGPD et droits des utilisateurs." },
      { property: "og:title", content: "Politique de Confidentialité — FIGDITIONS" },
      { property: "og:description", content: "Comment FIGDITIONS protège vos données personnelles et éditoriales." },
    ],
  }),
});

const toc = [
  { id: "qui", label: "1. Qui sommes-nous ?" },
  { id: "donnees", label: "2. Données collectées" },
  { id: "usage", label: "3. Utilisation" },
  { id: "stockage", label: "4. Stockage des données" },
  { id: "securite", label: "5. Sauvegardes & sécurité" },
  { id: "droits", label: "6. Vos droits (RGPD)" },
  { id: "partage", label: "7. Partage des données" },
  { id: "cookies", label: "8. Cookies" },
  { id: "ohada", label: "9. Conformité OHADA" },
  { id: "contact", label: "10. Contact & réclamations" },
  { id: "modifs", label: "11. Modifications" },
];

function PrivacyPage() {
  return (
    <LegalShell
      title="Politique de Confidentialité"
      subtitle="Dernière mise à jour : Mai 2026"
      toc={toc}
    >
      <Section id="qui" title="1. Qui sommes-nous ?">
        <p>
          FIGDITIONS est une plateforme SaaS de gestion éditoriale développée et exploitée
          par FIGDITIONS, dont le siège social est situé à Bamako, Mali.
        </p>
        <p>Contact : <a href="mailto:Figditions@gmail.com">Figditions@gmail.com</a></p>
      </Section>

      <Section id="donnees" title="2. Données collectées">
        <h3>Données d'identification</h3>
        <ul>
          <li>Nom complet, adresse email, mot de passe (chiffré), numéro de téléphone</li>
        </ul>
        <h3>Données professionnelles</h3>
        <ul>
          <li>Nom de la maison d'édition, adresse, ville</li>
        </ul>
        <h3>Données éditoriales</h3>
        <ul>
          <li>Manuscrits uploadés (fichiers PDF/Word)</li>
          <li>Informations sur les auteurs</li>
          <li>Données de ventes et de stocks</li>
          <li>Contrats générés</li>
        </ul>
        <h3>Données techniques</h3>
        <ul>
          <li>Adresse IP, type de navigateur</li>
          <li>Logs de connexion et d'activité</li>
        </ul>
        <h3>Données de paiement</h3>
        <ul>
          <li>Traitées exclusivement par PayDunya</li>
          <li>FIGDITIONS ne stocke <strong>jamais</strong> les données de carte bancaire</li>
        </ul>
      </Section>

      <Section id="usage" title="3. Comment nous utilisons vos données">
        <ul>
          <li>Fournir et améliorer nos services</li>
          <li>Gérer votre compte et votre abonnement</li>
          <li>Vous envoyer des notifications importantes</li>
          <li>Assurer la sécurité de la plateforme</li>
          <li>Respecter nos obligations légales</li>
        </ul>
      </Section>

      <Section id="stockage" title="4. Où sont stockées vos données ?">
        <p>
          Toutes vos données sont stockées de manière sécurisée sur les serveurs de Supabase,
          hébergés sur Amazon Web Services (AWS) en région Europe (eu-west-1, Irlande). Ces
          serveurs respectent les normes de sécurité ISO 27001 et SOC 2 Type II.
        </p>
        <table>
          <thead>
            <tr><th>Type de données</th><th>Serveur</th><th>Localisation</th></tr>
          </thead>
          <tbody>
            <tr><td>Données application</td><td>Supabase / AWS</td><td>Europe (Irlande)</td></tr>
            <tr><td>Fichiers PDF</td><td>Supabase Storage</td><td>Europe (Irlande)</td></tr>
            <tr><td>Paiements</td><td>PayDunya</td><td>Afrique de l'Ouest</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="securite" title="5. Sauvegardes et protection">
        <p>FIGDITIONS met en place les mesures suivantes pour protéger vos données :</p>
        <ul>
          <li>✅ Sauvegardes automatiques quotidiennes (Supabase Point-in-Time Recovery)</li>
          <li>✅ Chiffrement des données en transit (SSL/TLS)</li>
          <li>✅ Chiffrement des données au repos (AES-256)</li>
          <li>✅ Authentification à deux facteurs disponible</li>
          <li>✅ Politiques de sécurité au niveau des lignes (Row Level Security) — chaque maison d'édition ne peut accéder qu'à ses propres données</li>
          <li>✅ Aucun employé FIGDITIONS n'a accès à vos manuscrits sans votre autorisation explicite</li>
        </ul>
      </Section>

      <Section id="droits" title="6. Vos droits (RGPD + loi malienne)">
        <p>
          Conformément au RGPD européen et à la législation malienne sur la protection des
          données personnelles, vous disposez des droits suivants :
        </p>
        <ul>
          <li><strong>Droit d'accès</strong> : obtenir une copie de vos données</li>
          <li><strong>Droit de rectification</strong> : corriger vos données</li>
          <li><strong>Droit à l'effacement</strong> : supprimer votre compte</li>
          <li><strong>Droit à la portabilité</strong> : exporter vos données</li>
          <li><strong>Droit d'opposition</strong> : refuser certains traitements</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à <a href="mailto:Figditions@gmail.com">Figditions@gmail.com</a>.
          Délai de réponse : 30 jours maximum.
        </p>
      </Section>

      <Section id="partage" title="7. Partage des données">
        <p>FIGDITIONS ne vend <strong>jamais</strong> vos données à des tiers. Nous partageons uniquement avec :</p>
        <ul>
          <li>Supabase (infrastructure technique)</li>
          <li>PayDunya (traitement des paiements)</li>
          <li>Figuira Éditions (partenaire officiel, uniquement pour les fonctionnalités partagées)</li>
        </ul>
      </Section>

      <Section id="cookies" title="8. Cookies">
        <p>
          FIGDITIONS utilise uniquement des cookies techniques essentiels au fonctionnement
          de la plateforme. Aucun cookie publicitaire ou de tracking tiers n'est utilisé.
        </p>
      </Section>

      <Section id="ohada" title="9. Conformité OHADA">
        <p>
          En tant que plateforme opérant en zone OHADA, FIGDITIONS respecte les dispositions
          de l'Acte Uniforme OHADA relatif au droit commercial général concernant la
          protection des données commerciales et la confidentialité des contrats d'édition.
        </p>
      </Section>

      <Section id="contact" title="10. Contact et réclamations">
        <p>Pour toute question relative à cette politique :</p>
        <ul>
          <li>Email : <a href="mailto:Figditions@gmail.com">Figditions@gmail.com</a></li>
          <li>Adresse : Bamako, Mali</li>
        </ul>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez contacter
          l'Autorité de Protection des Données compétente.
        </p>
      </Section>

      <Section id="modifs" title="11. Modifications">
        <p>
          Nous nous réservons le droit de modifier cette politique. Vous serez notifié par
          email en cas de modification importante. La version en vigueur est toujours
          disponible sur cette page.
        </p>
      </Section>
    </LegalShell>
  );
}
