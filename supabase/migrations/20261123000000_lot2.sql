-- Lot 2 : zikr « par personne », créneaux par prière, modification de zikr et de voyage.

alter table public.zikr_definitions
  add column if not exists distribution_mode text not null default 'split' check (distribution_mode in ('split', 'per_person')),
  add column if not exists slot_plan jsonb,
  add column if not exists carry_over boolean not null default true;

-- Valide un plan de créneaux : [{"slot":"fajr","qty":100}, ...]
create or replace function public.check_slot_plan(p_plan jsonb)
returns void language plpgsql immutable as $$
declare e jsonb; v_seen text[] := '{}';
begin
  if p_plan is null then return; end if;
  if jsonb_typeof(p_plan) <> 'array' then raise exception 'Plan de créneaux invalide'; end if;
  for e in select * from jsonb_array_elements(p_plan) loop
    perform (e->>'slot')::time_slot;
    if (e->>'qty') is null or (e->>'qty')::bigint <= 0 then raise exception 'Quantité de créneau invalide'; end if;
    if (e->>'slot') = any(v_seen) then raise exception 'Créneau en double : %', e->>'slot'; end if;
    v_seen := v_seen || (e->>'slot');
  end loop;
end;
$$;

-- 1. Modifier la configuration d'un zikr -----------------------------------------
create or replace function public.update_zikr(
  p_zikr_id uuid, p_name_fr text, p_name_ar text, p_arabic_text text,
  p_default_slot time_slot, p_slot_plan jsonb, p_carry_over boolean, p_sort_order int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_zi uuid;
begin
  select ziyara_id into v_zi from public.zikr_definitions where id = p_zikr_id;
  if not found then raise exception 'Zikr introuvable'; end if;
  if not public.is_cheikh(v_zi) then raise exception 'Action réservée au gestionnaire'; end if;
  if coalesce(trim(p_name_fr), '') = '' or coalesce(trim(p_name_ar), '') = '' then raise exception 'Les deux noms sont obligatoires'; end if;
  if p_slot_plan is not null and jsonb_array_length(p_slot_plan) = 0 then p_slot_plan := null; end if;
  perform public.check_slot_plan(p_slot_plan);

  update public.zikr_definitions
  set name_fr = trim(p_name_fr), name_ar = trim(p_name_ar),
      arabic_text = nullif(trim(coalesce(p_arabic_text, '')), ''),
      default_slot = p_default_slot, slot_plan = p_slot_plan,
      carry_over = coalesce(p_carry_over, carry_over),
      sort_order = coalesce(p_sort_order, sort_order)
  where id = p_zikr_id;
end;
$$;

-- 2. Remettre à zéro les objectifs d'un zikr (les saisies déjà faites sont conservées)
create or replace function public.clear_zikr_goals(p_zikr_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_zi uuid;
begin
  select ziyara_id into v_zi from public.zikr_definitions where id = p_zikr_id;
  if not found then raise exception 'Zikr introuvable'; end if;
  if not public.is_cheikh(v_zi) then raise exception 'Action réservée au gestionnaire'; end if;
  delete from public.goal_redistributions where zikr_id = p_zikr_id;
  delete from public.common_pots where zikr_id = p_zikr_id;
  delete from public.member_goals where zikr_id = p_zikr_id;
  update public.zikr_definitions set total_target = null where id = p_zikr_id;
end;
$$;

-- 3. Zikr « par personne » : chaque participant fait la quantité entière -------------
-- p_mode : 'daily' (chaque jour), 'stay' (une fois sur tout le séjour), 'day' (un seul jour).
-- Avec un plan de créneaux, la quantité par personne et par cycle = somme des créneaux.
create or replace function public.assign_per_person(
  p_ziyara_id uuid, p_zikr_id uuid, p_quantity bigint, p_mode text, p_day date,
  p_member_ids uuid[], p_slot_plan jsonb default null, p_slot time_slot default 'anytime'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mgr uuid; v_zik record; v_zi record; v_members uuid[]; v_k int;
  v_dates date[]; v_qty bigint; v_m uuid; v_d date; v_slot time_slot;
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  v_mgr := public.current_member_id(p_ziyara_id);

  select array(select distinct x from unnest(p_member_ids) x) into v_members;
  v_k := coalesce(array_length(v_members, 1), 0);
  if v_k = 0 then raise exception 'Sélectionnez au moins un participant'; end if;
  if (select count(*) from public.group_members where ziyara_id = p_ziyara_id and id = any(v_members)) <> v_k then
    raise exception 'Participant invalide';
  end if;

  select * into v_zik from public.zikr_definitions where id = p_zikr_id and ziyara_id = p_ziyara_id;
  if not found then raise exception 'Zikr introuvable'; end if;
  select * into v_zi from public.ziyaras where id = p_ziyara_id;

  if p_slot_plan is not null and jsonb_array_length(p_slot_plan) = 0 then p_slot_plan := null; end if;
  perform public.check_slot_plan(p_slot_plan);
  if p_slot_plan is not null then
    select sum((e->>'qty')::bigint) into v_qty from jsonb_array_elements(p_slot_plan) e;
    v_slot := 'anytime';
  else
    v_qty := p_quantity; v_slot := p_slot;
  end if;
  if v_qty is null or v_qty <= 0 then raise exception 'La quantité par personne doit être strictement positive'; end if;

  if p_mode = 'daily' then
    select array_agg(d::date order by d) into v_dates
    from generate_series(v_zi.start_date, v_zi.end_date, interval '1 day') d;
  elsif p_mode = 'stay' then
    v_dates := array[null]::date[];
  elsif p_mode = 'day' then
    if p_day is null or p_day < v_zi.start_date or p_day > v_zi.end_date then raise exception 'Jour hors du séjour'; end if;
    v_dates := array[p_day];
  else
    raise exception 'Mode inconnu';
  end if;

  perform set_config('app.skip_goal_notify', 'on', true);
  foreach v_m in array v_members loop
    foreach v_d in array v_dates loop
      insert into public.member_goals (ziyara_id, member_id, zikr_id, target_date, slot, initial_target)
      values (p_ziyara_id, v_m, p_zikr_id, v_d, v_slot, v_qty)
      on conflict (ziyara_id, member_id, zikr_id, coalesce(target_date, '1970-01-01'::date))
      do update set initial_target = member_goals.initial_target + excluded.initial_target, updated_at = now();
    end loop;
  end loop;

  update public.zikr_definitions
  set total_target = coalesce(total_target, 0) + v_qty * v_k * array_length(v_dates, 1),
      scope = case p_mode when 'daily' then 'daily'::goal_scope when 'stay' then 'stay'::goal_scope else scope end,
      distribution_mode = 'per_person',
      slot_plan = coalesce(p_slot_plan, slot_plan),
      carry_over = case when coalesce(total_target, 0) = 0 then false else carry_over end
  where id = p_zikr_id;

  insert into public.user_notifications (ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload)
  select p_ziyara_id, m, 'goal_assigned',
    'Nouvel objectif : ' || v_zik.name_fr, 'هدف جديد : ' || v_zik.name_ar,
    v_qty * array_length(v_dates, 1) || ' ' || v_zik.name_fr || ' ajoutés à votre programme.',
    'أضيف ' || v_qty * array_length(v_dates, 1) || ' من ' || v_zik.name_ar || ' إلى برنامجك.',
    jsonb_build_object('zikr_id', p_zikr_id, 'quantity', v_qty * array_length(v_dates, 1))
  from unnest(v_members) m
  where m <> v_mgr;
  perform set_config('app.skip_goal_notify', 'off', true);

  return jsonb_build_object('participants', v_k, 'per_person_per_cycle', v_qty, 'cycles', array_length(v_dates, 1));
end;
$$;

-- 4. Modifier le voyage (nom, lieu, dates), avec décalage des objectifs et saisies ---
create or replace function public.update_ziyara(
  p_ziyara_id uuid, p_title_fr text, p_title_ar text, p_city text, p_timezone text,
  p_start date, p_end date, p_shift boolean default true
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare z record; v_delta int; v_big constant int := 100000; v_bad int;
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  select * into z from public.ziyaras where id = p_ziyara_id for update;
  if not found then raise exception 'Voyage introuvable'; end if;
  if p_start is null or p_end is null or p_end < p_start then raise exception 'Dates invalides'; end if;
  if coalesce(trim(p_title_fr), '') = '' or coalesce(trim(p_title_ar), '') = '' then raise exception 'Les deux titres sont obligatoires'; end if;
  perform now() at time zone coalesce(nullif(trim(p_timezone), ''), z.timezone);

  v_delta := p_start - z.start_date;

  if v_delta <> 0 and p_shift then
    if (p_end - p_start) <> (z.end_date - z.start_date) then
      raise exception 'Pour décaler le voyage, la durée doit rester de % jours', (z.end_date - z.start_date + 1);
    end if;
    update public.member_goals set target_date = target_date + (v_delta + v_big) where ziyara_id = p_ziyara_id and target_date is not null;
    update public.member_goals set target_date = target_date - v_big where ziyara_id = p_ziyara_id and target_date is not null;
    update public.common_pots set target_date = target_date + (v_delta + v_big) where ziyara_id = p_ziyara_id and target_date is not null;
    update public.common_pots set target_date = target_date - v_big where ziyara_id = p_ziyara_id and target_date is not null;
    update public.zikr_entries set entry_date = entry_date + v_delta where ziyara_id = p_ziyara_id;
    update public.goal_redistributions
      set target_date = target_date + v_delta, to_date = to_date + v_delta
      where ziyara_id = p_ziyara_id;
  elsif v_delta <> 0 or p_end <> z.end_date then
    select count(*) into v_bad from (
      select 1 from public.member_goals where ziyara_id = p_ziyara_id and target_date is not null and (target_date < p_start or target_date > p_end)
      union all
      select 1 from public.zikr_entries where ziyara_id = p_ziyara_id and (entry_date < p_start or entry_date > p_end)
    ) s;
    if v_bad > 0 then
      raise exception 'Des objectifs ou saisies sont hors de la nouvelle période (%). Activez le décalage ou réinitialisez les objectifs.', v_bad;
    end if;
  end if;

  update public.ziyaras
  set title_fr = trim(p_title_fr), title_ar = trim(p_title_ar),
      city = coalesce(nullif(trim(p_city), ''), city),
      timezone = coalesce(nullif(trim(p_timezone), ''), timezone),
      start_date = p_start, end_date = p_end
  where id = p_ziyara_id;

  return jsonb_build_object('shifted_days', case when p_shift then v_delta else 0 end, 'start_date', p_start, 'end_date', p_end);
end;
$$;

-- 5. Le report quotidien ignore les zikr dont le report est désactivé -----------------
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

  for g in
    select mg.* from public.member_goals mg
    join public.zikr_definitions zd on zd.id = mg.zikr_id
    where mg.ziyara_id = p_ziyara_id and mg.target_date = p_day and zd.carry_over
    for update of mg
  loop
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

-- 6. Droits d'exécution ---------------------------------------------------------------
revoke execute on function public.check_slot_plan(jsonb) from public, anon;
revoke execute on function public.update_zikr(uuid, text, text, text, time_slot, jsonb, boolean, int) from public, anon;
revoke execute on function public.clear_zikr_goals(uuid) from public, anon;
revoke execute on function public.assign_per_person(uuid, uuid, bigint, text, date, uuid[], jsonb, time_slot) from public, anon;
revoke execute on function public.update_ziyara(uuid, text, text, text, text, date, date, boolean) from public, anon;
revoke execute on function public.carry_over_day(uuid, date) from public, anon, authenticated;
grant execute on function public.update_zikr(uuid, text, text, text, time_slot, jsonb, boolean, int) to authenticated;
grant execute on function public.clear_zikr_goals(uuid) to authenticated;
grant execute on function public.assign_per_person(uuid, uuid, bigint, text, date, uuid[], jsonb, time_slot) to authenticated;
grant execute on function public.update_ziyara(uuid, text, text, text, text, date, date, boolean) to authenticated;
