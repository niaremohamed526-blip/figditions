# Plan

## Part 1 — Manuscript statuses (10 stages)

### Database migration
- Map enum `manuscrit_statut`: rename `lecture`→`relecture`, `correction`→`epreuve_1`; add `epreuve_2`, `epreuve_3`, `epreuve_4`, `echantillon`. Keep `recu`, `maquette`, `impression`, `publie`.
- Reorder so progression matches: recu, relecture, epreuve_1..4, maquette, echantillon, impression, publie.
- Postgres can't drop/rename enum values cleanly while in use → safest path: create new enum `manuscrit_statut_v2`, `ALTER TABLE manuscrits ALTER COLUMN statut TYPE manuscrit_statut_v2 USING (CASE statut::text WHEN 'lecture' THEN 'relecture' WHEN 'correction' THEN 'epreuve_1' ELSE statut::text END)::manuscrit_statut_v2`, drop old enum, rename v2 → `manuscrit_statut`.

### Code updates
- `src/components/status-badge.tsx`: rewrite MAP with 10 entries + colors specified; update `STATUT_OPTIONS` ordered list.
- Add helper `STATUT_PROGRESSION` (ordered array) used by stepper + analytics.
- Build new `src/components/status-stepper.tsx`: horizontal on `md+`, vertical on mobile; completed (✓ #00C896), current (pulse #D4AF37), upcoming (#1E3A5F outline); shows "Étape X sur 10".
- Embed stepper in `manuscrits.$manuscritId.tsx`.
- Update dashboard donut, manuscrits filter/select dropdowns, analytics stage-duration chart, finances/auteurs/contrats references — they all read from `STATUT_OPTIONS` so most adapt automatically; verify each file.

## Part 2 — Internal stock

### Database migration (same file as Part 1)
- Create `stock_interne` and `mouvements_stock` tables per spec.
- Enable RLS, add `ent ...` policies using `current_entreprise_id()` (matches existing convention; the spec's policy subquery is equivalent).
- Trigger `BEFORE INSERT` on both tables to default `entreprise_id := current_entreprise_id()` when null.

### UI: convert `stocks.tsx` into tabbed page
- Tab 1 "🏪 Stock Externe" = existing content extracted into `<StockExterne />` component (no behavior change).
- Tab 2 "🏭 Stock Interne" = new `<StockInterne />` component containing:
  - 4 summary cards (total stock, transferred, sold direct + revenue, low-stock alerts pulsing red).
  - Collapsible red low-stock alert panel.
  - Inventory table (published books) with color-coded `disponible` cell + action buttons.
  - Slide-in drawers using `<Sheet>`:
    - "Nouveau stock reçu" → upserts `stock_interne` row, inserts `mouvements_stock(type='impression')`.
    - "Enregistrer un mouvement" → applies quantity math per type, side-effects:
      - `transfert_librairie`: also insert into existing `stocks` table for destination bookstore.
      - `vente_directe`: also insert into `ventes` with `prix_vente_direct_fcfa`.
      - `perte`: confirm dialog.
      - `ajustement`: require note, set absolute value.
    - Low-stock toast after every movement.
  - History modal: header summary + chronological timeline (icon, signed qty, destination, user, datetime) + Recharts line chart of stock over time with red `seuil_alerte` reference line.
- Extend existing `InventoryAnalytics` with: distribution stacked bar (per book: % librairies/direct/événements/restant), top rotation list (days printing→sold out), total stock value metric card.

### Tech notes
- All FCFA via `fcfa()`. French copy. Dark theme tokens. Recharts for charts. shadcn Sheet/Dialog/Tabs.
- Mouvement effectue_par = `auth.uid()` via insert from client.
- Author/user-name resolution for history: join `profiles.full_name` via separate query keyed by user ids in the movements list.

## Files touched
- new `supabase/migrations/<ts>_status_and_internal_stock.sql`
- edit `src/components/status-badge.tsx`
- new `src/components/status-stepper.tsx`
- edit `src/routes/_authenticated/manuscrits.$manuscritId.tsx`
- edit `src/routes/_authenticated/stocks.tsx` (tabs + extract external + add internal)
- new `src/components/stock-interne.tsx` (+ subcomponents inline or split if large)
- verify (likely no change) dashboard / manuscrits.index / analytics-using files
