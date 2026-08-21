WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER w AS keeper_id,
         ROW_NUMBER() OVER w AS rn
  FROM public.stocks
  WINDOW w AS (PARTITION BY entreprise_id, manuscrit_id, lower(btrim(librairie_nom)) ORDER BY created_at, id)
),
adds AS (
  SELECT r.keeper_id,
         SUM(s.exemplaires_deposes)  AS dep,
         SUM(s.exemplaires_restants) AS rest,
         SUM(s.exemplaires_total)    AS tot
  FROM ranked r
  JOIN public.stocks s ON s.id = r.id
  WHERE r.rn > 1
  GROUP BY r.keeper_id
)
UPDATE public.stocks k
SET exemplaires_deposes  = k.exemplaires_deposes  + a.dep,
    exemplaires_restants = k.exemplaires_restants + a.rest,
    exemplaires_total    = k.exemplaires_total    + a.tot
FROM adds a
WHERE k.id = a.keeper_id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY entreprise_id, manuscrit_id, lower(btrim(librairie_nom)) ORDER BY created_at, id) AS rn
  FROM public.stocks
)
DELETE FROM public.stocks WHERE id IN (SELECT id FROM ranked WHERE rn > 1);