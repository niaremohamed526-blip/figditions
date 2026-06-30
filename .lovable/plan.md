# Pourquoi les images ne s'affichent pas sur Vercel

Toutes les images du site (logo, image hero, etc.) sont stockées sur le **CDN de Lovable** et servies via des URLs du type :

```
/__l5e/assets-v1/<asset_id>/<filename>
```

Ce préfixe `/__l5e/...` n'existe **que sur l'infrastructure d'hébergement Lovable**. Sur Vercel, ce chemin n'est routé nulle part → le navigateur reçoit du HTML (la page 404 SPA) à la place de l'image → image cassée.

Concrètement, les assets concernés sont au minimum :
- `src/assets/figditions-logo.png` (logo principal, partout : navbar, sidebar, footer, mobile)
- `src/assets/hero-figditions.png` (image héros de la landing page)
- Tout autre `*.png.asset.json` / `*.jpg.asset.json` présent dans `src/assets/`

## Solution

Rapatrier ces fichiers **dans le repo** pour qu'ils soient buildés et servis par Vercel comme n'importe quel asset statique.

### Étapes

1. **Inventorier** tous les fichiers `*.asset.json` dans `src/` (logo, hero, et tout autre asset CDN éventuel).
2. **Télécharger** chaque binaire depuis l'URL CDN actuelle (`https://<preview>.lovable.app/__l5e/assets-v1/...`) et l'écrire dans `public/assets/` (ex. `public/assets/figditions-logo.png`, `public/assets/hero-figditions.png`).
3. **Remplacer le composant `src/components/logo.tsx`** : il importe `figditions-logo.png.asset.json` et utilise `asset.url`. À la place, pointer sur `/assets/figditions-logo.png` (chemin public servi par Vite/Vercel).
4. **Mettre à jour `src/routes/index.tsx`** (et tout autre fichier qui importe un `.asset.json`) pour utiliser le chemin `/assets/...` au lieu de `assetJson.url`.
5. **Supprimer les fichiers `.asset.json` migrés** pour éviter la confusion future.
6. **Vérifier** : `bun run build` doit passer, et la preview doit afficher logo + hero comme avant. Une fois redéployé sur Vercel, les images chargeront.

### Effet de bord important

Sur Lovable, ces images étaient sur CDN (rapides, hors bundle). En les remettant dans `public/`, elles sont servies par Vercel directement. C'est parfait pour Vercel, et ça continue de fonctionner sur Lovable. **Le hero fait ~2 Mo** — je recommande de le recompresser (WebP ou JPEG qualité 80) après migration ; je peux le faire dans la foulée si tu veux.

## Ce qui n'est PAS touché

- Aucun changement de logique, de DB, de PayDunya, de Supabase.
- Aucun changement visuel : mêmes images, mêmes positions.
- Les `.asset.json` non utilisés sur le site Vercel (s'il y en a) peuvent rester.

## Question ouverte

Confirme-tu que tu veux que je **télécharge les binaires depuis le CDN Lovable et les commit dans `public/assets/`** ? (C'est la voie la plus simple et la plus fiable. L'alternative — héberger les images sur Supabase Storage — est plus lourde et apporte zéro bénéfice ici.)
