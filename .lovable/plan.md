# Configuration des variables Vercel pour les notifications push

## Ce que vous pouvez coller tout de suite dans Vercel

| Variable | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY` | `BJWxqit4Asas6CGXI_TPIbqt020oxkGefCQKVoaFyceUovkkVR7jjXeW-CEMVrdhEZH2OraZASFjcBuwFR59AXw` |
| `PUSH_TRIGGER_SECRET` | `8a48db41e0c770d8596be13c11aa9a88ea26e2526f8000f9045dcf304670e153` |
| `VAPID_SUBJECT` | `mailto:contact@figditions.xyz` (remplacez par votre email si vous préférez) |

## Le cas de `VAPID_PRIVATE_KEY`

Une clé privée, une fois stockée dans le coffre sécurisé Lovable, ne se relit plus — elle ne peut qu'être utilisée côté serveur. Je ne peux donc pas vous l'afficher, même si c'est moi qui l'ai générée.

Solution proposée : **régénérer une paire VAPID complète** et vous fournir les deux clés à copier dans Vercel.

## Étapes d'implémentation (en mode build)

1. Générer une nouvelle paire VAPID (P-256).
2. Afficher **les deux clés** (publique + privée) directement dans le chat pour que vous les colliez dans Vercel.
3. Mettre à jour la clé publique dans le code : `src/lib/push.ts` (constante `VAPID_PUBLIC_KEY`).
4. Purger la table `push_subscriptions` (les abonnements existants deviennent invalides avec une nouvelle paire).
5. Résumé final avec la liste des 4 variables à coller dans Vercel + rappel de redéployer sans cache.

## Ce que vous ferez ensuite dans Vercel

1. Ajouter les 4 variables ci-dessus dans **Settings → Environment Variables** (Production + Preview).
2. Redéployer sans cache.
3. Ouvrir FIGDITIONS → Paramètres → Compte → **Activer les notifications**.
