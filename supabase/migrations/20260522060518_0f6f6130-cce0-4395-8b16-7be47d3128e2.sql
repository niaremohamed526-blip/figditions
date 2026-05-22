-- Rebuild estimations_cout with advanced columns
drop table if exists public.estimations_cout cascade;

create table public.estimations_cout (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null,
  manuscrit_id uuid,
  nom_estimation text not null,

  type_livre text,
  nombre_pages integer,
  tirage integer,
  format text,
  interieur_couleur boolean default false,
  type_reliure text,
  finition_couverture text,
  qualite_papier text,
  langue text default 'français',
  depot_legal boolean default false,

  cout_mise_en_page_fcfa numeric default 0,
  cout_conception_couverture_fcfa numeric default 0,
  cout_isbn_fcfa numeric default 0,
  supplement_langue_nationale_fcfa numeric default 0,

  cout_papier_fcfa numeric default 0,
  cout_encre_fcfa numeric default 0,
  cout_couverture_fcfa numeric default 0,
  cout_reliure_fcfa numeric default 0,
  cout_setup_offset_fcfa numeric default 0,

  cout_decoupe_fcfa numeric default 0,
  cout_emballage_fcfa numeric default 0,
  cout_livraison_fcfa numeric default 0,

  cout_groupe_electrogene_fcfa numeric default 0,

  sous_total_prepress_fcfa numeric default 0,
  sous_total_production_fcfa numeric default 0,
  sous_total_postpress_fcfa numeric default 0,
  marge_imprimeur_fcfa numeric default 0,
  cout_total_fcfa numeric default 0,

  methode_impression text,
  prix_vente_suggere_fcfa numeric default 0,
  marge_librairie_fcfa numeric default 0,
  droits_auteur_fcfa numeric default 0,

  created_at timestamp with time zone not null default now()
);

alter table public.estimations_cout enable row level security;

create policy "ent select estimations" on public.estimations_cout
  for select using (entreprise_id = public.current_entreprise_id());
create policy "ent insert estimations" on public.estimations_cout
  for insert with check (entreprise_id = public.current_entreprise_id());
create policy "ent update estimations" on public.estimations_cout
  for update using (entreprise_id = public.current_entreprise_id());
create policy "ent delete estimations" on public.estimations_cout
  for delete using (entreprise_id = public.current_entreprise_id());

-- Printers directory (shared)
create table if not exists public.imprimeries (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  adresse text,
  telephone text,
  email text,
  site_web text,
  specialites text[],
  types_impression text[],
  description text,
  est_partenaire boolean default false,
  created_at timestamp with time zone not null default now()
);

alter table public.imprimeries enable row level security;

create policy "anyone authenticated reads imprimeries" on public.imprimeries
  for select to authenticated using (true);

create policy "admins insert imprimeries" on public.imprimeries
  for insert to authenticated with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "admins update imprimeries" on public.imprimeries
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "admins delete imprimeries" on public.imprimeries
  for delete to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

insert into public.imprimeries (nom, adresse, telephone, email, site_web, specialites, types_impression, description, est_partenaire) values
('Imprim-Services SA','Hamdallaye ACI 2000, Immeuble ABK2, Porte M0603, Bamako','+223 20 29 39 75','imprimservices@yahoo.fr','https://imprimservices.net',
  ARRAY['Livres','Documents officiels','PAO','Reliure'], ARRAY['Offset','Numérique','Reprographie','Traceur'],
  'Fondée en 1997, Imprim-Services est spécialisée dans tout type d''impression offset et numérique avec une capacité de plus de 5000 documents à l''heure. Services PAO, mise en page, corrections et retouches photos.', true),
('Print Art Mali','Bamako, Mali',null,null,'http://printartml.com',
  ARRAY['Livres','Petit tirage','Moyen tirage'], ARRAY['Numérique'],
  'Imprimerie spécialisée dans l''impression numérique pour petits et moyens tirages à Bamako.', false),
('Graphique Industrie','BP 2412, Bamako',null,null,'http://www.graphique-industrie.com',
  ARRAY['Livres','Documents'], ARRAY['Offset','Numérique'],
  'Imprimerie professionnelle à Bamako.', false),
('Imprim+ Mali','Bamako, Mali',null,null,'https://www.imprimplusmali.com',
  ARRAY['Livres','Cartes','Documents'], ARRAY['Numérique'],
  'Service d''impression en ligne avec livraison rapide à Bamako. Engagé dans une démarche éco-responsable.', false),
('DConcept Plus','Bamako, Mali',null,null,'https://www.dconceptplus.net',
  ARRAY['Livres','Bâches','Cartes de visite'], ARRAY['Numérique','Grand format'],
  'Leader de l''impression à Bamako, service en Afrique de l''Ouest.', false);
