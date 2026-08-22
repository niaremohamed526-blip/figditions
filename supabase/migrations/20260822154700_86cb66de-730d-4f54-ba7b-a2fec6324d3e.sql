create table public.medmo_ocr_corrections (
  id uuid not null default gen_random_uuid() primary key,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type_correction text not null,
  texte_extrait text not null,
  valeur_correcte text not null,
  created_at timestamp with time zone not null default now()
);
grant select, insert on public.medmo_ocr_corrections to authenticated;
grant all on public.medmo_ocr_corrections to service_role;
alter table public.medmo_ocr_corrections enable row level security;
create policy "ent select" on public.medmo_ocr_corrections for select to authenticated using (entreprise_id = private.current_entreprise_id());
create policy "ent insert" on public.medmo_ocr_corrections for insert to authenticated with check (entreprise_id = private.current_entreprise_id());

create table public.medmo_ocr_logs (
  id uuid not null default gen_random_uuid() primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nombre_photos integer not null default 1,
  entrees jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now()
);
grant select, insert on public.medmo_ocr_logs to authenticated;
grant all on public.medmo_ocr_logs to service_role;
alter table public.medmo_ocr_logs enable row level security;
create policy "ent select" on public.medmo_ocr_logs for select to authenticated using (entreprise_id = private.current_entreprise_id());
create policy "ent insert" on public.medmo_ocr_logs for insert to authenticated with check (entreprise_id = private.current_entreprise_id());