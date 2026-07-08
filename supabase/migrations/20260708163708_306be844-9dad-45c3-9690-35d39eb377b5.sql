
-- 1) Restore profiles for auth users invited who ended up without a profile.
--    Pick the most recent matching invitation per user to avoid duplicates.
WITH candidates AS (
  SELECT DISTINCT ON (u.id)
    u.id AS user_id,
    u.email,
    u.raw_user_meta_data,
    i.entreprise_id,
    i.permissions,
    i.role_label,
    i.full_name AS inv_full_name
  FROM auth.users u
  JOIN public.invitations i ON lower(i.email) = lower(u.email)
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
    AND i.entreprise_id IS NOT NULL
  ORDER BY u.id, i.created_at DESC
)
INSERT INTO public.profiles (id, full_name, entreprise_id, role, permissions, role_label)
SELECT
  c.user_id,
  COALESCE(c.inv_full_name, c.raw_user_meta_data->>'full_name', split_part(c.email, '@', 1)),
  c.entreprise_id,
  'membre',
  COALESCE(c.permissions, '{"dashboard":true}'::jsonb) || '{"parametres":false}'::jsonb,
  c.role_label
FROM candidates c
ON CONFLICT (id) DO NOTHING;

-- Ensure their invitations are marked accepted
UPDATE public.invitations i
SET statut = 'acceptee'
FROM auth.users u
WHERE lower(i.email) = lower(u.email)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id AND p.entreprise_id = i.entreprise_id)
  AND i.statut = 'en_attente';

-- 2) Harden handle_new_user: wrap the invite branch in EXCEPTION handling and fall back
--    to a default profile so a failed invite-INSERT never leaves the user without one.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_ent_id UUID;
  v_full_name TEXT;
  v_ent_nom TEXT;
  v_ville TEXT;
  v_invite_token UUID;
  v_inv RECORD;
  v_owner_id UUID;
  v_profile_created BOOLEAN := false;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_invite_token := NULLIF(NEW.raw_user_meta_data->>'invite_token', '')::uuid;

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.invitations
    WHERE token = v_invite_token
      AND statut = 'en_attente'
      AND expires_at > now()
    LIMIT 1;

    IF v_inv.id IS NOT NULL THEN
      BEGIN
        SELECT owner_id INTO v_owner_id FROM public.entreprises WHERE id = v_inv.entreprise_id;

        IF v_owner_id = NEW.id THEN
          INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions)
          VALUES (
            NEW.id,
            COALESCE(v_inv.full_name, v_full_name),
            v_inv.entreprise_id,
            'admin',
            '{"dashboard":true,"manuscrits":true,"auteurs":true,"stocks_interne":true,"stocks_externe":true,"finances":true,"contrats":true,"conversions":true,"estimateur":true,"imprimeries":true,"parametres":true}'::jsonb
          );
        ELSE
          INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions, role_label)
          VALUES (
            NEW.id,
            COALESCE(v_inv.full_name, v_full_name),
            v_inv.entreprise_id,
            'membre',
            COALESCE(v_inv.permissions, '{"dashboard":true}'::jsonb) || '{"parametres":false}'::jsonb,
            v_inv.role_label
          );
        END IF;
        UPDATE public.invitations SET statut = 'acceptee' WHERE id = v_inv.id;
        v_profile_created := true;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user invite branch failed for user %: %', NEW.id, SQLERRM;
      END;

      IF v_profile_created THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  -- Fallback: create a default profile+entreprise if none exists yet.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    v_ent_nom := COALESCE(NEW.raw_user_meta_data->>'entreprise_nom', v_full_name || ' Éditions');
    v_ville := COALESCE(NEW.raw_user_meta_data->>'ville', 'Bamako');

    INSERT INTO public.entreprises(nom, ville, owner_id)
    VALUES (v_ent_nom, v_ville, NEW.id)
    RETURNING id INTO new_ent_id;

    INSERT INTO public.profiles(id, full_name, entreprise_id, role, permissions)
    VALUES (
      NEW.id, v_full_name, new_ent_id, 'admin',
      '{"dashboard":true,"manuscrits":true,"auteurs":true,"stocks_interne":true,"stocks_externe":true,"finances":true,"contrats":true,"conversions":true,"estimateur":true,"imprimeries":true,"parametres":true}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Cleanup the temporary diagnostic helper
DROP FUNCTION IF EXISTS public._debug_profile(uuid);
