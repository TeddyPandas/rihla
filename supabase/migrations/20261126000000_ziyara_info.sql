-- Section « Informations » : programme jour par jour et infos pratiques d'un voyage.
-- Lecture : tous les membres du voyage. Écriture : gestionnaires.
create table if not exists public.ziyara_info (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  category text not null check (category in ('programme','infos')),
  title_fr text not null,
  title_ar text,
  body_fr text not null default '',
  body_ar text,
  day_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ziyara_info_ziyara_idx on public.ziyara_info (ziyara_id, category, sort_order);
alter table public.ziyara_info enable row level security;
drop policy if exists ziyara_info_select on public.ziyara_info;
create policy ziyara_info_select on public.ziyara_info for select to authenticated using (current_member_id(ziyara_id) is not null);
drop policy if exists ziyara_info_cheikh_all on public.ziyara_info;
create policy ziyara_info_cheikh_all on public.ziyara_info for all to authenticated using (is_cheikh(ziyara_id)) with check (is_cheikh(ziyara_id));
grant select, insert, update, delete on public.ziyara_info to authenticated;
create or replace function public.ziyara_info_touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists ziyara_info_touch on public.ziyara_info;
create trigger ziyara_info_touch before update on public.ziyara_info for each row execute function public.ziyara_info_touch();
