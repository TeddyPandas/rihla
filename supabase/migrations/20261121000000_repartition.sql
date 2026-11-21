-- Répartition des zikr (v2) : distribution automatique, report, gestionnaires, Réserve.

-- 1. Schéma ------------------------------------------------------------------
alter table public.zikr_definitions
  add column if not exists total_target bigint check (total_target is null or total_target >= 0);

alter table public.goal_redistributions add column if not exists to_date date;
alter type redistribution_mode add value if not exists 'carryover';

alter table public.goal_redistributions drop constraint if exists valid_redistribution_target;
alter table public.goal_redistributions add constraint valid_redistribution_target check (
  (mode::text = 'pot' and to_member_id is null) or
  (mode::text = 'targeted' and to_member_id is not null and to_member_id <> from_member_id) or
  (mode::text = 'carryover' and to_member_id = from_member_id and to_date is not null)
);

alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications add constraint user_notifications_type_check check (
  type in ('goal_assigned', 'redistribution_received', 'pot_opened', 'entry_corrected', 'carried_over')
);

-- 2. Quantité accomplie pour un objectif -------------------------------------
-- Objectif daté : saisies de ce jour. Objectif « séjour » (date nulle) : saisies
-- des jours qui n'ont pas d'objectif daté pour ce membre et ce zikr.
create or replace function public.goal_done(p_ziyara_id uuid, p_member_id uuid, p_zikr_id uuid, p_date date)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(e.quantity), 0)::bigint
  from public.zikr_entries e
  where e.ziyara_id = p_ziyara_id and e.member_id = p_member_id and e.zikr_id = p_zikr_id
    and e.source = 'personal' and e.status = 'active'
    and (
      (p_date is not null and e.entry_date = p_date)
      or (p_date is null and not exists (
        select 1 from public.member_goals g
        where g.ziyara_id = e.ziyara_id and g.member_id = e.member_id
          and g.zikr_id = e.zikr_id and g.target_date = e.entry_date
      ))
    );
$$;

-- Les notifications automatiques de objectifs sont coupées pendant une répartition en lot.
create or replace function public.notify_goal_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fr text; v_ar text; v_qty bigint;
begin
  if coalesce(current_setting('app.skip_goal_notify', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    if new.initial_target <= 0 then return new; end if;
    v_qty := new.initial_target;
  else
    if new.initial_target <= old.initial_target then return new; end if;
    v_qty := new.initial_target - old.initial_target;
  end if;
  select name_fr, name_ar into v_fr, v_ar from public.zikr_definitions where id = new.zikr_id;
  insert into public.user_notifications (
    ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload
  ) values (
    new.ziyara_id, new.member_id, 'goal_assigned',
    'Nouvel objectif : ' || v_fr, 'هدف جديد : ' || v_ar,
    '+' || v_qty || ' ' || v_fr || ' ajoutés à votre programme.',
    'أضيف +' || v_qty || ' من ' || v_ar || ' إلى برنامجك.',
    jsonb_build_object('zikr_id', new.zikr_id, 'quantity', v_qty, 'target_date', new.target_date)
  );
  return new;
end;
$$;

-- 3. Répartition automatique d'un total ---------------------------------------
-- p_mode : 'daily' (total ÷ jours ÷ participants), 'stay' (total ÷ participants, sans jour),
--          'day' (total ÷ participants sur p_day).
-- Le surplus de chaque division revient au gestionnaire qui lance la répartition.
create or replace function public.distribute_zikr(
  p_ziyara_id uuid, p_zikr_id uuid, p_total bigint, p_mode text,
  p_day date, p_member_ids uuid[], p_slot time_slot default 'anytime'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mgr uuid; v_zik record; v_zi record;
  v_members uuid[]; v_k int;
  v_dates date[]; v_qtys bigint[];
  v_n int; v_per bigint; v_rem int; v_i int;
  v_share bigint; v_surplus bigint; v_m uuid;
  v_share_sum bigint := 0; v_surplus_sum bigint := 0;
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  v_mgr := public.current_member_id(p_ziyara_id);

  if p_total is null or p_total <= 0 then raise exception 'Le total doit être strictement positif'; end if;

  select array(select distinct x from unnest(p_member_ids) x) into v_members;
  v_k := coalesce(array_length(v_members, 1), 0);
  if v_k = 0 then raise exception 'Sélectionnez au moins un participant'; end if;
  if (select count(*) from public.group_members where ziyara_id = p_ziyara_id and id = any(v_members)) <> v_k then
    raise exception 'Participant invalide';
  end if;

  select * into v_zik from public.zikr_definitions where id = p_zikr_id and ziyara_id = p_ziyara_id;
  if not found then raise exception 'Zikr introuvable'; end if;
  select * into v_zi from public.ziyaras where id = p_ziyara_id;

  if p_mode = 'daily' then
    select array_agg(d::date order by d) into v_dates
    from generate_series(v_zi.start_date, v_zi.end_date, interval '1 day') d;
    v_n := array_length(v_dates, 1);
    v_per := p_total / v_n;
    v_rem := (p_total % v_n)::int;
    v_qtys := '{}';
    for v_i in 1..v_n loop
      v_qtys := v_qtys || (v_per + case when v_i <= v_rem then 1 else 0 end);
    end loop;
  elsif p_mode = 'stay' then
    v_dates := array[null]::date[];
    v_qtys := array[p_total];
  elsif p_mode = 'day' then
    if p_day is null or p_day < v_zi.start_date or p_day > v_zi.end_date then
      raise exception 'Jour hors du séjour';
    end if;
    v_dates := array[p_day];
    v_qtys := array[p_total];
  else
    raise exception 'Mode de répartition inconnu';
  end if;

  perform set_config('app.skip_goal_notify', 'on', true);

  for v_i in 1..array_length(v_dates, 1) loop
    v_share := v_qtys[v_i] / v_k;
    v_surplus := v_qtys[v_i] - v_share * v_k;
    v_surplus_sum := v_surplus_sum + v_surplus;
    v_share_sum := v_share_sum + v_share;

    if v_share > 0 then
      foreach v_m in array v_members loop
        insert into public.member_goals (ziyara_id, member_id, zikr_id, target_date, slot, initial_target)
        values (p_ziyara_id, v_m, p_zikr_id, v_dates[v_i], p_slot, v_share)
        on conflict (ziyara_id, member_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
        do update set initial_target = member_goals.initial_target + excluded.initial_target, updated_at = now();
      end loop;
    end if;

    if v_surplus > 0 then
      insert into public.member_goals (ziyara_id, member_id, zikr_id, target_date, slot, initial_target)
      values (p_ziyara_id, v_mgr, p_zikr_id, v_dates[v_i], p_slot, v_surplus)
      on conflict (ziyara_id, member_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
      do update set initial_target = member_goals.initial_target + excluded.initial_target, updated_at = now();
    end if;
  end loop;

  update public.zikr_definitions
  set total_target = coalesce(total_target, 0) + p_total,
      scope = case p_mode when 'daily' then 'daily'::goal_scope when 'stay' then 'stay'::goal_scope else scope end
  where id = p_zikr_id;

  -- Une notification par participant (hors gestionnaire).
  insert into public.user_notifications (
    ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload
  )
  select p_ziyara_id, m, 'goal_assigned',
    'Nouvel objectif : ' || v_zik.name_fr, 'هدف جديد : ' || v_zik.name_ar,
    '+' || v_share_sum || ' ' || v_zik.name_fr || ' ajoutés à votre programme.',
    'أضيف +' || v_share_sum || ' من ' || v_zik.name_ar || ' إلى برنامجك.',
    jsonb_build_object('zikr_id', p_zikr_id, 'quantity', v_share_sum)
  from unnest(v_members) m
  where m <> v_mgr;

  perform set_config('app.skip_goal_notify', 'off', true);

  return jsonb_build_object('participants', v_k, 'share_total_per_member', v_share_sum, 'surplus_to_manager', v_surplus_sum);
end;
$$;

-- 4. Redistribution : chaque attribution peut viser un jour précis ------------
create or replace function public.redistribute_remaining(
  p_ziyara_id uuid, p_zikr_id uuid, p_target_date date, p_from_member_id uuid,
  p_pot_qty bigint, p_targeted_allocations jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mgr uuid; v_goal record; v_done bigint; v_available bigint;
  v_targeted_sum bigint := 0; v_total bigint;
  v_alloc jsonb; v_to uuid; v_qty bigint; v_to_date date;
  v_fr text; v_ar text;
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  v_mgr := public.current_member_id(p_ziyara_id);

  select name_fr, name_ar into v_fr, v_ar from public.zikr_definitions where id = p_zikr_id and ziyara_id = p_ziyara_id;
  if not found then raise exception 'Zikr introuvable'; end if;

  select * into v_goal from public.member_goals
  where ziyara_id = p_ziyara_id and member_id = p_from_member_id and zikr_id = p_zikr_id
    and coalesce(target_date, '1970-01-01'::date) = coalesce(p_target_date, '1970-01-01'::date)
  for update;
  if not found then raise exception 'Objectif source introuvable'; end if;

  v_done := public.goal_done(p_ziyara_id, p_from_member_id, p_zikr_id, p_target_date);
  v_available := (v_goal.initial_target + v_goal.adjusted_delta) - v_done;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_targeted_allocations, '[]'::jsonb)) loop
    v_qty := (v_alloc->>'quantity')::bigint;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantité attribuée invalide'; end if;
    if not exists (select 1 from public.group_members where id = (v_alloc->>'member_id')::uuid and ziyara_id = p_ziyara_id) then
      raise exception 'Destinataire invalide';
    end if;
    v_targeted_sum := v_targeted_sum + v_qty;
  end loop;

  v_total := coalesce(p_pot_qty, 0) + v_targeted_sum;
  if v_total <= 0 or v_total > v_available then
    raise exception 'Quantité totale redistribuée (%) invalide ou supérieure au reste disponible (%)', v_total, v_available;
  end if;

  update public.member_goals set adjusted_delta = adjusted_delta - v_total, updated_at = now() where id = v_goal.id;

  if coalesce(p_pot_qty, 0) > 0 then
    insert into public.common_pots (ziyara_id, zikr_id, target_date, allocated_quantity)
    values (p_ziyara_id, p_zikr_id, p_target_date, p_pot_qty)
    on conflict (ziyara_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
    do update set allocated_quantity = common_pots.allocated_quantity + excluded.allocated_quantity, updated_at = now();

    insert into public.goal_redistributions (ziyara_id, zikr_id, target_date, from_member_id, to_member_id, mode, quantity, created_by)
    values (p_ziyara_id, p_zikr_id, p_target_date, p_from_member_id, null, 'pot', p_pot_qty, v_mgr);

    insert into public.user_notifications (ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload)
    values (p_ziyara_id, null, 'pot_opened',
      'Réserve alimentée : ' || v_fr, 'تمت تغذية الاحتياطي : ' || v_ar,
      p_pot_qty || ' ' || v_fr || ' disponibles dans la Réserve.',
      'يوجد ' || p_pot_qty || ' من ' || v_ar || ' في الاحتياطي.',
      jsonb_build_object('zikr_id', p_zikr_id, 'quantity', p_pot_qty));
  end if;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_targeted_allocations, '[]'::jsonb)) loop
    v_to := (v_alloc->>'member_id')::uuid;
    v_qty := (v_alloc->>'quantity')::bigint;
    v_to_date := coalesce((v_alloc->>'target_date')::date, p_target_date);

    insert into public.member_goals (ziyara_id, member_id, zikr_id, target_date, slot, initial_target, adjusted_delta)
    values (p_ziyara_id, v_to, p_zikr_id, v_to_date, v_goal.slot, 0, v_qty)
    on conflict (ziyara_id, member_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
    do update set adjusted_delta = member_goals.adjusted_delta + excluded.adjusted_delta, updated_at = now();

    insert into public.goal_redistributions (ziyara_id, zikr_id, target_date, from_member_id, to_member_id, mode, quantity, created_by, to_date)
    values (p_ziyara_id, p_zikr_id, p_target_date, p_from_member_id, v_to, 'targeted', v_qty, v_mgr, v_to_date);

    insert into public.user_notifications (ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload)
    values (p_ziyara_id, v_to, 'redistribution_received',
      'Nouvelle attribution : ' || v_fr, 'تكليف إضافي : ' || v_ar,
      'Le gestionnaire vous a attribué +' || v_qty || ' ' || v_fr || '.',
      'أسند إليك المسؤول +' || v_qty || ' من ' || v_ar || '.',
      jsonb_build_object('zikr_id', p_zikr_id, 'quantity', v_qty, 'target_date', v_to_date));
  end loop;
end;
$$;

-- Annulation : tient compte du jour de destination et refuse les reports automatiques.
create or replace function public.cancel_redistribution(p_redistribution_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; v_mgr uuid; v_done bigint; v_goal record; v_pot record; v_to_date date;
begin
  select * into r from public.goal_redistributions where id = p_redistribution_id for update;
  if not found then raise exception 'Redistribution introuvable'; end if;
  if not public.is_cheikh(r.ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  if r.status <> 'active' then raise exception 'Redistribution déjà annulée'; end if;
  if r.mode::text = 'carryover' then raise exception 'Un report automatique ne peut pas être annulé'; end if;
  v_mgr := public.current_member_id(r.ziyara_id);

  if r.mode::text = 'pot' then
    select * into v_pot from public.common_pots
    where ziyara_id = r.ziyara_id and zikr_id = r.zikr_id
      and coalesce(target_date, '1970-01-01'::date) = coalesce(r.target_date, '1970-01-01'::date)
    for update;
    select coalesce(sum(quantity), 0) into v_done from public.zikr_entries
    where ziyara_id = r.ziyara_id and zikr_id = r.zikr_id and source = 'pot' and status = 'active';
    if (select coalesce(sum(allocated_quantity), 0) from public.common_pots where ziyara_id = r.ziyara_id and zikr_id = r.zikr_id) - r.quantity < v_done then
      raise exception 'Impossible : des membres ont déjà puisé dans la Réserve';
    end if;
    update public.common_pots set allocated_quantity = allocated_quantity - r.quantity, updated_at = now() where id = v_pot.id;
  else
    v_to_date := coalesce(r.to_date, r.target_date);
    select * into v_goal from public.member_goals
    where ziyara_id = r.ziyara_id and member_id = r.to_member_id and zikr_id = r.zikr_id
      and coalesce(target_date, '1970-01-01'::date) = coalesce(v_to_date, '1970-01-01'::date)
    for update;
    v_done := public.goal_done(r.ziyara_id, r.to_member_id, r.zikr_id, v_to_date);
    if (v_goal.initial_target + v_goal.adjusted_delta - r.quantity) < v_done then
      raise exception 'Impossible : le membre a déjà accompli cette quantité';
    end if;
    update public.member_goals set adjusted_delta = adjusted_delta - r.quantity, updated_at = now() where id = v_goal.id;
  end if;

  update public.member_goals set adjusted_delta = adjusted_delta + r.quantity, updated_at = now()
  where ziyara_id = r.ziyara_id and member_id = r.from_member_id and zikr_id = r.zikr_id
    and coalesce(target_date, '1970-01-01'::date) = coalesce(r.target_date, '1970-01-01'::date);

  update public.goal_redistributions
  set status = 'cancelled', cancelled_by = v_mgr, cancelled_at = now(),
      cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Annulé par le gestionnaire')
  where id = r.id;
end;
$$;

-- 5. Report automatique du reste non terminé au lendemain ----------------------
create or replace function public.carry_over_day(p_ziyara_id uuid, p_day date)
returns int language plpgsql security definer set search_path = public as $$
declare
  z record; g record; v_done bigint; v_rem bigint; v_cnt int := 0; v_next date;
  v_fr text; v_ar text;
begin
  select * into z from public.ziyaras where id = p_ziyara_id;
  if not found or p_day < z.start_date or p_day >= z.end_date then return 0; end if;
  v_next := p_day + 1;
  perform set_config('app.skip_goal_notify', 'on', true);

  for g in select * from public.member_goals where ziyara_id = p_ziyara_id and target_date = p_day for update loop
    v_done := public.goal_done(g.ziyara_id, g.member_id, g.zikr_id, p_day);
    v_rem := (g.initial_target + g.adjusted_delta) - v_done;
    if v_rem > 0 then
      update public.member_goals set adjusted_delta = adjusted_delta - v_rem, updated_at = now() where id = g.id;

      insert into public.member_goals (ziyara_id, member_id, zikr_id, target_date, slot, initial_target, adjusted_delta)
      values (g.ziyara_id, g.member_id, g.zikr_id, v_next, g.slot, 0, v_rem)
      on conflict (ziyara_id, member_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
      do update set adjusted_delta = member_goals.adjusted_delta + excluded.adjusted_delta, updated_at = now();

      insert into public.goal_redistributions (ziyara_id, zikr_id, target_date, from_member_id, to_member_id, mode, quantity, created_by, to_date)
      values (g.ziyara_id, g.zikr_id, p_day, g.member_id, g.member_id, 'carryover', v_rem, g.member_id, v_next);

      select name_fr, name_ar into v_fr, v_ar from public.zikr_definitions where id = g.zikr_id;
      insert into public.user_notifications (ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload)
      values (g.ziyara_id, g.member_id, 'carried_over',
        'Reste reporté : ' || v_fr, 'متبقٍّ منقول : ' || v_ar,
        v_rem || ' ' || v_fr || ' non terminés ont été reportés à demain.',
        'تم نقل ' || v_rem || ' من ' || v_ar || ' غير المكتملة إلى الغد.',
        jsonb_build_object('zikr_id', g.zikr_id, 'quantity', v_rem, 'to_date', v_next));
      v_cnt := v_cnt + 1;
    end if;
  end loop;

  perform set_config('app.skip_goal_notify', 'off', true);
  return v_cnt;
end;
$$;

create or replace function public.carry_over_all()
returns void language plpgsql security definer set search_path = public as $$
declare z record;
begin
  for z in select * from public.ziyaras where is_active loop
    perform public.carry_over_day(z.id, ((now() at time zone z.timezone)::date - 1));
  end loop;
end;
$$;

-- Déclenchement manuel par un gestionnaire (secours si la tâche planifiée est absente).
create or replace function public.run_carry_over(p_ziyara_id uuid, p_day date)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  return public.carry_over_day(p_ziyara_id, p_day);
end;
$$;

-- Tâche planifiée : 00h05 heure de Fès (23h05 UTC), rejouée à 00h05 UTC par sécurité (idempotent).
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ziyara-carry-over', '5 23,0 * * *', 'select public.carry_over_all()');
exception when others then
  raise notice 'pg_cron indisponible (%). Utiliser run_carry_over ou un cron externe.', sqlerrm;
end $$;

-- 6. Gestionnaires -------------------------------------------------------------
create or replace function public.set_member_role(p_ziyara_id uuid, p_member_id uuid, p_role user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  if p_role = 'member' and not exists (
    select 1 from public.group_members where ziyara_id = p_ziyara_id and role = 'cheikh' and id <> p_member_id
  ) then
    raise exception 'Il faut au moins un gestionnaire';
  end if;
  update public.group_members set role = p_role where id = p_member_id and ziyara_id = p_ziyara_id;
  if not found then raise exception 'Membre introuvable'; end if;
end;
$$;

-- 7. Réserve : on ne peut puiser que ce qui y reste ------------------------------
create or replace function public.sync_member_batch(p_ziyara_id uuid, p_mutations jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_member_id uuid; v_mut jsonb;
  v_processed_ids jsonb := '[]'::jsonb; v_failed jsonb := '[]'::jsonb;
  v_mut_id uuid; v_type text; v_zikr uuid; v_source entry_source; v_qty bigint; v_left bigint;
begin
  v_member_id := public.current_member_id(p_ziyara_id);
  if v_member_id is null then raise exception 'Membre non autorisé pour ce séjour'; end if;

  for v_mut in select * from jsonb_array_elements(p_mutations) loop
    begin
      v_mut_id := (v_mut->>'client_mutation_id')::uuid;
      v_type := v_mut->>'type';

      if v_type = 'create_entry' then
        v_zikr := (v_mut->>'zikr_id')::uuid;
        v_source := coalesce((v_mut->>'source')::entry_source, 'personal');
        v_qty := (v_mut->>'quantity')::bigint;

        if not exists (select 1 from public.zikr_definitions where id = v_zikr and ziyara_id = p_ziyara_id) then
          raise exception 'Zikr inconnu pour ce séjour';
        end if;

        if v_source = 'pot' and not exists (select 1 from public.zikr_entries where client_mutation_id = v_mut_id) then
          select coalesce((select sum(allocated_quantity) from public.common_pots where ziyara_id = p_ziyara_id and zikr_id = v_zikr), 0)
               - coalesce((select sum(quantity) from public.zikr_entries where ziyara_id = p_ziyara_id and zikr_id = v_zikr and source = 'pot' and status = 'active'), 0)
          into v_left;
          if v_qty > v_left then raise exception 'Réserve insuffisante (reste %)', v_left; end if;
        end if;

        insert into public.zikr_entries (client_mutation_id, ziyara_id, member_id, zikr_id, entry_date, source, quantity, created_at_client)
        values (v_mut_id, p_ziyara_id, v_member_id, v_zikr, (v_mut->>'entry_date')::date, v_source, v_qty, (v_mut->>'created_at_client')::timestamptz)
        on conflict (client_mutation_id) do nothing;

      elsif v_type = 'cancel_entry' then
        update public.zikr_entries
        set status = 'cancelled', cancelled_at = now(), cancelled_by = v_member_id,
            cancel_reason = coalesce(v_mut->>'reason', 'Annulé par le membre')
        where client_mutation_id = (v_mut->>'target_client_mutation_id')::uuid
          and member_id = v_member_id and status = 'active';
      else
        raise exception 'Type de mutation inconnu';
      end if;

      v_processed_ids := v_processed_ids || to_jsonb(v_mut_id::text);
    exception when others then
      if v_mut_id is not null then
        v_processed_ids := v_processed_ids || to_jsonb(v_mut_id::text);
        v_failed := v_failed || jsonb_build_object('id', v_mut_id, 'error', sqlerrm);
      end if;
    end;
  end loop;

  update public.group_members set last_synced_at = now() where id = v_member_id;
  return jsonb_build_object('processed_ids', v_processed_ids, 'failed', v_failed, 'synced_at', now());
end;
$$;

-- 8. Droits d'exécution --------------------------------------------------------
revoke execute on function public.goal_done(uuid, uuid, uuid, date) from public, anon, authenticated;
revoke execute on function public.carry_over_day(uuid, date) from public, anon, authenticated;
revoke execute on function public.carry_over_all() from public, anon, authenticated;
revoke execute on function public.distribute_zikr(uuid, uuid, bigint, text, date, uuid[], time_slot) from public, anon;
revoke execute on function public.run_carry_over(uuid, date) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, user_role) from public, anon;
grant execute on function public.distribute_zikr(uuid, uuid, bigint, text, date, uuid[], time_slot) to authenticated;
grant execute on function public.run_carry_over(uuid, date) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, user_role) to authenticated;
