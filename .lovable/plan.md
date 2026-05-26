## Problem

`src/routes/_authenticated/manuscrits.tsx` and `src/routes/_authenticated/manuscrits.$manuscritId.tsx` both exist. In TanStack file-based routing the first file becomes the **parent layout** for the second. Because the list page doesn't render `<Outlet />`, navigating to `/manuscrits/<id>` matches the route but only the list UI shows — so the new PDF upload zone is never rendered.

On top of that, the list table has no link/button to open a manuscript's detail page.

## Fix

1. **Rename** `src/routes/_authenticated/manuscrits.tsx` → `src/routes/_authenticated/manuscrits.index.tsx` so it only matches `/manuscrits` exactly and stops acting as a layout wrapper. Update the `createFileRoute` path inside the file accordingly. The auto-generated `routeTree.gen.ts` will pick this up on next build.

2. **Make list rows open the detail page.** In the renamed `manuscrits.index.tsx`, wrap each row's title cell (or add a small "Ouvrir" icon-button in the Actions column) with `<Link to="/manuscrits/$manuscritId" params={{ manuscritId: m.id }}>` so the user can click into the manuscript.

3. **Verify** by navigating to `/manuscrits`, clicking a manuscript title, and confirming the detail page renders with:
   - "📄 Fichier du manuscrit" section with the dashed `#00C896` drag-drop zone
   - "🔒 Partage Sécurisé" section below it
   - Warning banner when no PDF is uploaded yet

## Where to find it once fixed

From the sidebar → **Manuscrits** → click any row's title → you'll land on the detail page that contains the PDF upload zone.

No database, RLS, or styling changes are needed — just the routing fix and a clickable row.