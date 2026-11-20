-- Extensions
create extension if not exists "pgcrypto";

-- Types énumérés
do $$ begin
  create type user_role as enum ('cheikh', 'member');
  create type goal_scope as enum ('daily', 'stay');
  create type time_slot as enum ('morning', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'night', 'anytime');
  create type entry_source as enum ('personal', 'pot');
  create type entry_status as enum ('active', 'cancelled');
  create type redistribution_mode as enum ('targeted', 'pot');
  create type redistribution_status as enum ('active', 'cancelled');
exception when duplicate_object then null;
end $$;

-- 1. Séjours / Groupes
create table if not exists public.ziyaras (
  id uuid primary key default gen_random_uuid(),
  title_fr text not null,
  title_ar text not null,
  city text not null default 'Fès',
  timezone text not null default 'Africa/Casablanca',
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint valid_dates check (end_date >= start_date)
);

-- 2. Membres du groupe
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  full_name text,
  role user_role not null default 'member',
  must_change_password boolean not null default true,
  preferred_lang text not null default 'fr' check (preferred_lang in ('fr', 'ar')),
  reminder_prefs jsonb not null default '{"morning": true, "fajr": true, "dhuhr": true, "asr": true, "maghrib": true, "isha": true, "night": true, "offset_minutes": 10}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (ziyara_id, user_id),
  unique (ziyara_id, phone_e164)
);

-- 3. Définitions des Zikr
create table if not exists public.zikr_definitions (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  name_fr text not null,
  name_ar text not null,
  arabic_text text,
  scope goal_scope not null default 'daily',
  default_slot time_slot not null default 'anytime',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Objectifs par membre
create table if not exists public.member_goals (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  zikr_id uuid not null references public.zikr_definitions(id) on delete cascade,
  target_date date,
  slot time_slot not null default 'anytime',
  initial_target bigint not null check (initial_target >= 0),
  adjusted_delta bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint effective_target_non_negative check (initial_target + adjusted_delta >= 0)
);

create unique index if not exists idx_member_goals_unique on public.member_goals (
  ziyara_id, member_id, zikr_id, coalesce(target_date, '1970-01-01'::date)
);

-- 5. Pot commun volontaire
create table if not exists public.common_pots (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  zikr_id uuid not null references public.zikr_definitions(id) on delete cascade,
  target_date date,
  allocated_quantity bigint not null default 0 check (allocated_quantity >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_common_pots_unique on public.common_pots (
  ziyara_id, zikr_id, coalesce(target_date, '1970-01-01'::date)
);

-- 6. Grand livre des redistributions
create table if not exists public.goal_redistributions (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  zikr_id uuid not null references public.zikr_definitions(id) on delete cascade,
  target_date date,
  from_member_id uuid not null references public.group_members(id),
  to_member_id uuid references public.group_members(id),
  mode redistribution_mode not null,
  quantity bigint not null check (quantity > 0),
  status redistribution_status not null default 'active',
  created_by uuid not null references public.group_members(id),
  created_at timestamptz not null default now(),
  cancelled_by uuid references public.group_members(id),
  cancelled_at timestamptz,
  cancel_reason text,
  constraint valid_redistribution_target check (
    (mode = 'pot' and to_member_id is null) or
    (mode = 'targeted' and to_member_id is not null and to_member_id <> from_member_id)
  )
);

-- 7. Saisies de zikr (Append-only & Idempotent)
create table if not exists public.zikr_entries (
  id uuid primary key default gen_random_uuid(),
  client_mutation_id uuid not null unique,
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  zikr_id uuid not null references public.zikr_definitions(id) on delete cascade,
  entry_date date not null,
  source entry_source not null default 'personal',
  quantity bigint not null check (quantity > 0),
  status entry_status not null default 'active',
  created_at_client timestamptz not null,
  synced_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.group_members(id),
  cancel_reason text,
  replaced_by_entry_id uuid references public.zikr_entries(id)
);

create index if not exists idx_entries_ziyara_date on public.zikr_entries(ziyara_id, entry_date, status);
create index if not exists idx_entries_member on public.zikr_entries(member_id, status);

-- 8. Notifications in-app & Push
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  recipient_member_id uuid references public.group_members(id) on delete cascade,
  type text not null check (type in ('goal_assigned', 'redistribution_received', 'pot_opened', 'entry_corrected')),
  title_fr text not null,
  title_ar text not null,
  body_fr text not null,
  body_ar text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.user_notifications(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, member_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.group_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- 9. Horaires de prière Fès
create table if not exists public.fes_prayer_times (
  prayer_date date primary key,
  fajr time not null,
  sunrise time not null,
  dhuhr time not null,
  asr time not null,
  maghrib time not null,
  isha time not null
);

-- 10. Biographie Seydina Cheikh
create table if not exists public.biography_chapters (
  id uuid primary key default gen_random_uuid(),
  chapter_number int not null unique,
  title_fr text not null,
  title_ar text not null,
  content_md_fr text not null,
  content_md_ar text not null,
  is_sample boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Activation RLS
alter table public.ziyaras enable row level security;
alter table public.group_members enable row level security;
alter table public.zikr_definitions enable row level security;
alter table public.member_goals enable row level security;
alter table public.common_pots enable row level security;
alter table public.goal_redistributions enable row level security;
alter table public.zikr_entries enable row level security;
alter table public.user_notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.fes_prayer_times enable row level security;
alter table public.biography_chapters enable row level security;

-- Fonctions utilitaires RLS
create or replace function public.current_member_id(p_ziyara_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.group_members
  where user_id = auth.uid() and ziyara_id = p_ziyara_id
  limit 1;
$$;

create or replace function public.is_cheikh(p_ziyara_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where user_id = auth.uid() and ziyara_id = p_ziyara_id and role = 'cheikh'
  );
$$;

-- Politiques RLS
create policy "ziyaras_select" on public.ziyaras for select
  using (public.current_member_id(id) is not null);

create policy "members_select_own_or_cheikh" on public.group_members for select
  using (user_id = auth.uid() or public.is_cheikh(ziyara_id));

create policy "members_update_own" on public.group_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "zikr_defs_select" on public.zikr_definitions for select
  using (public.current_member_id(ziyara_id) is not null);

create policy "zikr_defs_cheikh_all" on public.zikr_definitions for all
  using (public.is_cheikh(ziyara_id))
  with check (public.is_cheikh(ziyara_id));

create policy "goals_select" on public.member_goals for select
  using (member_id = public.current_member_id(ziyara_id) or public.is_cheikh(ziyara_id));

create policy "goals_cheikh_all" on public.member_goals for all
  using (public.is_cheikh(ziyara_id))
  with check (public.is_cheikh(ziyara_id));

create policy "pots_select" on public.common_pots for select
  using (public.current_member_id(ziyara_id) is not null);

create policy "entries_select" on public.zikr_entries for select
  using (member_id = public.current_member_id(ziyara_id) or public.is_cheikh(ziyara_id));

create policy "redistributions_cheikh_select" on public.goal_redistributions for select
  using (public.is_cheikh(ziyara_id));

create policy "notifications_select" on public.user_notifications for select
  using (
    public.current_member_id(ziyara_id) is not null
    and (recipient_member_id = public.current_member_id(ziyara_id) or recipient_member_id is null)
  );

create policy "notification_reads_own" on public.notification_reads for all
  using (
    exists (
      select 1 from public.group_members gm
      where gm.id = member_id and gm.user_id = auth.uid()
    )
  );

create policy "push_subs_own" on public.push_subscriptions for all
  using (
    exists (
      select 1 from public.group_members gm
      where gm.id = member_id and gm.user_id = auth.uid()
    )
  );

create policy "prayer_times_select" on public.fes_prayer_times for select
  using (auth.uid() is not null);

create policy "biography_select" on public.biography_chapters for select
  using (auth.uid() is not null);

-- RPC 1 : Totaux du groupe par zikr
create or replace function public.get_group_zikr_summary(p_ziyara_id uuid)
returns table (
  zikr_id uuid,
  total_initial_target bigint,
  total_effective_personal_target bigint,
  total_done_personal bigint,
  total_done_pot bigint,
  pot_allocated bigint,
  pot_remaining bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_member_id(p_ziyara_id) is null then
    raise exception 'Accès refusé';
  end if;

  return query
  with goals_agg as (
    select
      mg.zikr_id,
      coalesce(sum(mg.initial_target), 0)::bigint as init_t,
      coalesce(sum(mg.initial_target + mg.adjusted_delta), 0)::bigint as eff_t
    from public.member_goals mg
    where mg.ziyara_id = p_ziyara_id
    group by mg.zikr_id
  ),
  entries_agg as (
    select
      ze.zikr_id,
      coalesce(sum(ze.quantity) filter (where ze.source = 'personal' and ze.status = 'active'), 0)::bigint as done_pers,
      coalesce(sum(ze.quantity) filter (where ze.source = 'pot' and ze.status = 'active'), 0)::bigint as done_pot
    from public.zikr_entries ze
    where ze.ziyara_id = p_ziyara_id
    group by ze.zikr_id
  ),
  pots_agg as (
    select
      cp.zikr_id,
      coalesce(sum(cp.allocated_quantity), 0)::bigint as pot_alloc
    from public.common_pots cp
    where cp.ziyara_id = p_ziyara_id
    group by cp.zikr_id
  )
  select
    zd.id as zikr_id,
    coalesce(ga.init_t, 0) as total_initial_target,
    coalesce(ga.eff_t, 0) as total_effective_personal_target,
    coalesce(ea.done_pers, 0) as total_done_personal,
    coalesce(ea.done_pot, 0) as total_done_pot,
    coalesce(pa.pot_alloc, 0) as pot_allocated,
    greatest(coalesce(pa.pot_alloc, 0) - coalesce(ea.done_pot, 0), 0)::bigint as pot_remaining
  from public.zikr_definitions zd
  left join goals_agg ga on ga.zikr_id = zd.id
  left join entries_agg ea on ea.zikr_id = zd.id
  left join pots_agg pa on pa.zikr_id = zd.id
  where zd.ziyara_id = p_ziyara_id
  order by zd.sort_order asc;
end;
$$;

-- RPC 2 : Synchronisation par lot idempotente
create or replace function public.sync_member_batch(p_ziyara_id uuid, p_mutations jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_member_id uuid;
  v_mut jsonb;
  v_processed_ids jsonb := '[]'::jsonb;
  v_mut_id uuid;
  v_type text;
begin
  v_member_id := public.current_member_id(p_ziyara_id);
  if v_member_id is null then
    raise exception 'Membre non autorisé pour ce séjour';
  end if;

  for v_mut in select * from jsonb_array_elements(p_mutations)
  loop
    v_mut_id := (v_mut->>'client_mutation_id')::uuid;
    v_type := v_mut->>'type';

    if v_type = 'create_entry' then
      insert into public.zikr_entries (
        client_mutation_id, ziyara_id, member_id, zikr_id,
        entry_date, source, quantity, created_at_client
      )
      values (
        v_mut_id,
        p_ziyara_id,
        v_member_id,
        (v_mut->>'zikr_id')::uuid,
        (v_mut->>'entry_date')::date,
        coalesce((v_mut->>'source')::entry_source, 'personal'),
        (v_mut->>'quantity')::bigint,
        (v_mut->>'created_at_client')::timestamptz
      )
      on conflict (client_mutation_id) do nothing;

    elsif v_type = 'cancel_entry' then
      update public.zikr_entries
      set
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = v_member_id,
        cancel_reason = coalesce(v_mut->>'reason', 'Annulé par le membre')
      where client_mutation_id = (v_mut->>'target_client_mutation_id')::uuid
        and member_id = v_member_id
        and status = 'active';
    end if;

    v_processed_ids := v_processed_ids || to_jsonb(v_mut_id::text);
  end loop;

  update public.group_members
  set last_synced_at = now()
  where id = v_member_id;

  return jsonb_build_object('processed_ids', v_processed_ids, 'synced_at', now());
end;
$$;

-- RPC 3 : Redistribution atomique des restes
create or replace function public.redistribute_remaining(
  p_ziyara_id uuid,
  p_zikr_id uuid,
  p_target_date date,
  p_from_member_id uuid,
  p_pot_qty bigint,
  p_targeted_allocations jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cheikh_id uuid;
  v_goal record;
  v_done bigint;
  v_available bigint;
  v_targeted_sum bigint := 0;
  v_total_redistributed bigint;
  v_alloc jsonb;
  v_target_member_id uuid;
  v_alloc_qty bigint;
  v_zikr_fr text;
  v_zikr_ar text;
begin
  if not public.is_cheikh(p_ziyara_id) then
    raise exception 'Action réservée au Cheikh';
  end if;

  v_cheikh_id := public.current_member_id(p_ziyara_id);

  select name_fr, name_ar into v_zikr_fr, v_zikr_ar
  from public.zikr_definitions where id = p_zikr_id;

  select * into v_goal
  from public.member_goals
  where ziyara_id = p_ziyara_id
    and member_id = p_from_member_id
    and zikr_id = p_zikr_id
    and coalesce(target_date, '1970-01-01'::date) = coalesce(p_target_date, '1970-01-01'::date)
  for update;

  if not found then
    raise exception 'Objectif source introuvable';
  end if;

  select coalesce(sum(quantity), 0) into v_done
  from public.zikr_entries
  where ziyara_id = p_ziyara_id
    and member_id = p_from_member_id
    and zikr_id = p_zikr_id
    and source = 'personal'
    and status = 'active'
    and (p_target_date is null or entry_date = p_target_date);

  v_available := (v_goal.initial_target + v_goal.adjusted_delta) - v_done;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_targeted_allocations, '[]'::jsonb))
  loop
    v_alloc_qty := (v_alloc->>'quantity')::bigint;
    if v_alloc_qty <= 0 then
      raise exception 'Quantité attribuée invalide';
    end if;
    v_targeted_sum := v_targeted_sum + v_alloc_qty;
  end loop;

  v_total_redistributed := coalesce(p_pot_qty, 0) + v_targeted_sum;

  if v_total_redistributed <= 0 or v_total_redistributed > v_available then
    raise exception 'Quantité totale redistribuée (%) invalide ou supérieure au reste disponible (%)', v_total_redistributed, v_available;
  end if;

  update public.member_goals
  set adjusted_delta = adjusted_delta - v_total_redistributed,
      updated_at = now()
  where id = v_goal.id;

  if coalesce(p_pot_qty, 0) > 0 then
    insert into public.common_pots (ziyara_id, zikr_id, target_date, allocated_quantity)
    values (p_ziyara_id, p_zikr_id, p_target_date, p_pot_qty)
    on conflict (ziyara_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
    do update set allocated_quantity = common_pots.allocated_quantity + excluded.allocated_quantity,
                  updated_at = now();

    insert into public.goal_redistributions (
      ziyara_id, zikr_id, target_date, from_member_id, to_member_id, mode, quantity, created_by
    ) values (
      p_ziyara_id, p_zikr_id, p_target_date, p_from_member_id, null, 'pot', p_pot_qty, v_cheikh_id
    );

    insert into public.user_notifications (
      ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload
    ) values (
      p_ziyara_id, null, 'pot_opened',
      'Pot commun ouvert : ' || v_zikr_fr,
      'فتح وعاء مشترك : ' || v_zikr_ar,
      p_pot_qty || ' ' || v_zikr_fr || ' disponibles en contribution volontaire.',
      'تمت إضافة ' || p_pot_qty || ' من ' || v_zikr_ar || ' للمساهمة التطوعية.',
      jsonb_build_object('zikr_id', p_zikr_id, 'quantity', p_pot_qty)
    );
  end if;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_targeted_allocations, '[]'::jsonb))
  loop
    v_target_member_id := (v_alloc->>'member_id')::uuid;
    v_alloc_qty := (v_alloc->>'quantity')::bigint;

    insert into public.member_goals (
      ziyara_id, member_id, zikr_id, target_date, slot, initial_target, adjusted_delta
    ) values (
      p_ziyara_id, v_target_member_id, p_zikr_id, p_target_date, v_goal.slot, 0, v_alloc_qty
    )
    on conflict (ziyara_id, member_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
    do update set adjusted_delta = member_goals.adjusted_delta + excluded.adjusted_delta,
                  updated_at = now();

    insert into public.goal_redistributions (
      ziyara_id, zikr_id, target_date, from_member_id, to_member_id, mode, quantity, created_by
    ) values (
      p_ziyara_id, p_zikr_id, p_target_date, p_from_member_id, v_target_member_id, 'targeted', v_alloc_qty, v_cheikh_id
    );

    insert into public.user_notifications (
      ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload
    ) values (
      p_ziyara_id, v_target_member_id, 'redistribution_received',
      'Nouvelle attribution : ' || v_zikr_fr,
      'تكليف إضافي : ' || v_zikr_ar,
      'Le Cheikh vous a attribué +' || v_alloc_qty || ' ' || v_zikr_fr || '.',
      'أسند إليك الشيخ +' || v_alloc_qty || ' من ' || v_zikr_ar || '.',
      jsonb_build_object('zikr_id', p_zikr_id, 'quantity', v_alloc_qty)
    );
  end loop;
end;
$$;

-- RPC 4 : Correction ou annulation auditée par le Cheikh
create or replace function public.cheikh_correct_entry(
  p_entry_id uuid,
  p_new_quantity bigint,
  p_reason text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_entry record;
  v_cheikh_id uuid;
  v_new_id uuid;
begin
  select * into v_entry from public.zikr_entries where id = p_entry_id for update;
  if not found then
    raise exception 'Saisie introuvable';
  end if;

  if not public.is_cheikh(v_entry.ziyara_id) then
    raise exception 'Action réservée au Cheikh';
  end if;

  v_cheikh_id := public.current_member_id(v_entry.ziyara_id);

  if p_new_quantity > 0 then
    insert into public.zikr_entries (
      client_mutation_id, ziyara_id, member_id, zikr_id,
      entry_date, source, quantity, created_at_client
    ) values (
      gen_random_uuid(), v_entry.ziyara_id, v_entry.member_id, v_entry.zikr_id,
      v_entry.entry_date, v_entry.source, p_new_quantity, now()
    ) returning id into v_new_id;
  end if;

  update public.zikr_entries
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_cheikh_id,
    cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Corrigé par le Cheikh'),
    replaced_by_entry_id = v_new_id
  where id = p_entry_id;
end;
$$;
