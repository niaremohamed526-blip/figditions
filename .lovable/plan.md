# Rebuild Contract Generator — Professional Malian Publishing Contract

## Scope
Full rebuild across DB, settings, form, PDF, and list. Estimated 6 files touched/created plus 2 migrations. This is a large change (~1500 lines of new code, mainly the PDF generator).

## 1. Database migrations (2 migrations)

**Migration A — `contrats` table**: add nif_editeur, rccm_editeur, nina_editeur, compte_bancaire, banque, livres jsonb, territoire_mali/ci/senegal/france, duree_annees, contribution_auteur, lieu_signature, date_signature, nom_representant_editeur, qualite_representant, adresse_auteur, telephone_auteur, profession_auteur, tirage_minimum, exemplaires_auteur, cachet_url, plus new fields: collection, format, type_couverture, reliure, frequence_paiement. Also add `'resilie'` to statut check constraint.

**Migration B — `entreprises` table**: add nif, rccm, nina, compte_bancaire, banque, nom_representant, qualite_representant, cachet_url, adresse, telephone, email_contact, website.

## 2. Paramètres — Maison d'édition section

In `src/routes/_authenticated/parametres.tsx`, extend the company form with the new legal fields (NIF, RCCM, NINA, banque, compte, représentant, qualité) and a cachet upload (reusing `logos` bucket, path `cachets/{entreprise_id}/...`).

## 3. Contract form rebuild — `src/routes/_authenticated/contrats.tsx`

Replace the `ContratSheet` with a multi-section form:
- **Parties**: éditeur auto-filled read-only card from `entreprises`; auteur dropdown + adresse/profession fields.
- **Objet**: collection name + dynamic books list (add/remove up to 10, each pick from manuscrits or manual title).
- **Conditions**: durée, %droits, tirage minimum, contribution auteur, format, couverture, reliure, exemplaires auteur, fréquence paiement, commissions 4 territoires, lieu/date signature.
- **Statut**: brouillon/signé/expiré/résilié.
- Auto-save draft to localStorage every 30s; "Aperçu PDF" button generates without saving.
- Uses existing `useCloseGuard` for unsaved changes.

Persist `livres` as jsonb `[{manuscrit_id?, titre}]`. Keep `manuscrit_id` = first book (existing FK required).

## 4. Professional PDF — new `src/lib/pdf-contrat-pro.ts`

Replace `src/lib/pdf-contrat.ts` usage. jsPDF A4, 25mm margins, Times (built-in `times`), 1.6 line height. Header on every page (logo + company + tagline + contact line + separator). Footer on every page (NIF/RCCM/NINA + banque/compte + Page X/Y). Title "Contrat d'édition" centered underlined. Parties block. All 18 articles with exact French templates from spec, variables interpolated. Signature block with two columns; if `cachet_url` present, embed image on éditeur side. Book list formatted `« Titre1 » et « Titre2 »`. French date format via `date-fns/locale/fr`.

Called from both the form's "Aperçu" button and the list/detail "Télécharger PDF" action.

## 5. List page updates

In `contrats.tsx` table:
- Books count badge (from `livres` array length, fallback to 1).
- Territory coverage summary (e.g. "ML/CI/SN/FR").
- Duration remaining (computed from `date_signature + duree_annees`).
- Status badges with 4 colors (add résilié = orange).
- Expiry warning `⚠️ Expire dans X jours` when < 90 days.

## Out of scope
- Cachet re-crop UI (simple upload only).
- Server-side PDF (all client-side per spec).
- Detail page rewrite — will only swap the PDF generator; layout stays.

## Technical notes
- jsPDF ships Times/Helvetica/Courier built-in — no font registration needed.
- Cachet image loaded via `fetch → blob → dataURL` then `doc.addImage`.
- New `livres` jsonb kept alongside existing `manuscrit_id` for back-compat; existing contracts read fine.
- No RLS changes needed — new columns inherit table policies.

## Deliverables checklist
1. Migration A + B
2. Updated parametres.tsx (company legal fields + cachet upload)
3. New pdf-contrat-pro.ts (~800 lines)
4. Rebuilt ContratSheet in contrats.tsx with all sections + auto-save
5. Updated list table with books count, territories, expiry warning
6. Wire the new PDF generator into list/detail download actions

Confirm and I'll ship it in one pass.