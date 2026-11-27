-- Attribution des chambres par hôtel. Le gestionnaire écrit ; un membre lit seulement sa chambre via my_rooms().
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  hotel text not null,
  hotel_sort int not null default 0,
  room_label text not null,
  capacity int not null default 2 check (capacity > 0),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists rooms_ziyara_idx on public.rooms (ziyara_id, hotel_sort, room_label);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  hotel text not null,
  created_at timestamptz not null default now(),
  unique (ziyara_id, hotel, member_id)
);
create index if not exists room_members_room_idx on public.room_members (room_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
drop policy if exists rooms_cheikh_all on public.rooms;
create policy rooms_cheikh_all on public.rooms for all to authenticated using (is_cheikh(ziyara_id)) with check (is_cheikh(ziyara_id));
drop policy if exists room_members_cheikh_all on public.room_members;
create policy room_members_cheikh_all on public.room_members for all to authenticated using (is_cheikh(ziyara_id)) with check (is_cheikh(ziyara_id));
grant select, insert, update, delete on public.rooms, public.room_members to authenticated;

create or replace function public.my_rooms(p_ziyara_id uuid)
returns table (hotel text, room_label text, notes text, roommates text[])
language sql stable security definer set search_path to 'public' as $$
  select r.hotel, r.room_label, r.notes,
         coalesce((select array_agg(coalesce(nullif(m2.full_name, ''), 'Participant') order by m2.full_name)
                   from public.room_members rm2 join public.group_members m2 on m2.id = rm2.member_id
                   where rm2.room_id = r.id and rm2.member_id <> rm.member_id), '{}'::text[])
  from public.room_members rm join public.rooms r on r.id = rm.room_id
  where rm.ziyara_id = p_ziyara_id and rm.member_id = public.current_member_id(p_ziyara_id)
  order by r.hotel_sort, r.hotel;
$$;
revoke all on function public.my_rooms(uuid) from public, anon;
grant execute on function public.my_rooms(uuid) to authenticated;
