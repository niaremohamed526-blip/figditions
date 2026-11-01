-- Note de mise à jour v2.9 : s'affiche en plein écran à la prochaine connexion
-- de chaque utilisateur, puis reste dans la cloche, rubrique « Quoi de neuf ».
INSERT INTO public.changelog_entries (titre, hook, version, items)
VALUES (
  'Contrats, stocks et une nouvelle allure',
  'Vos contrats partent de vos propres modèles, et FIGDITIONS change d''allure.',
  '2.9',
  '[
    {"type": "nouveaute", "page_concernee": "contrats", "texte": "Modèles de contrat de la maison : rédigez vos clauses une fois, puis créez chaque nouveau contrat à partir de ce modèle. Le texte signé est figé et la copie signée reste attachée au contrat."},
    {"type": "nouveaute", "page_concernee": "contrats", "texte": "Importez votre contrat actuel (Word, PDF ou photo) : Pr. MEDMO le transforme en modèle prêt à l''emploi."},
    {"type": "nouveaute", "page_concernee": "dashboard", "texte": "Votre brief du jour : chaque matin, à votre première visite, une page résume ce qui demande votre attention (stocks faibles, dépôts presque vides, paiements en attente, contrats qui expirent)."},
    {"type": "nouveaute", "page_concernee": "parametres", "texte": "Thème clair, sombre ou automatique : par défaut, l''application suit le réglage de votre appareil."},
    {"type": "amelioration", "page_concernee": "stocks", "texte": "Renommez une librairie ou corrigez son adresse : le changement s''applique partout."},
    {"type": "amelioration", "page_concernee": "stocks", "texte": "Changez d''un coup la date de dépôt de tous les livres d''une librairie."},
    {"type": "amelioration", "page_concernee": "stocks", "texte": "Le bouton vente d''un livre ouvre la vente déjà remplie, et la saisie rapide permet de choisir la commission de la librairie et les droits d''auteur."},
    {"type": "amelioration", "page_concernee": "global", "texte": "Nouvelle allure : titres, connexion et inscription reprennent le style du site, et les nouveautés s''affichent désormais en plein écran."},
    {"type": "amelioration", "page_concernee": "medmo", "texte": "Pr. MEDMO commence à répondre plus vite et explique clairement la cause quand il ne peut pas répondre."},
    {"type": "correction", "page_concernee": "global", "texte": "Plus de faux message « Accès restreint » quand la connexion est lente."},
    {"type": "correction", "page_concernee": "auteurs", "texte": "Les fiches auteur et contrat s''ouvrent bien sur le détail, et non plus sur la liste."}
  ]'::jsonb
);
