-- Lot 3 : rappels du gestionnaire, plusieurs voyages, suivi global.

-- 1. Nouveau type de notification : rappel
alter table public.user_notifications drop constraint if exists user_notifications_type_check;
alter table public.user_notifications add constraint user_notifications_type_check
  check (type = any (array['goal_assigned','redistribution_received','pot_opened','entry_corrected','carried_over','reminder']));

-- 2. Envoi d'un rappel (p_member_ids null = tous les membres du voyage)
create or replace function public.send_reminder(
  p_ziyara_id uuid, p_member_ids uuid[], p_title_fr text, p_title_ar text, p_body_fr text, p_body_ar text
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Réservé aux gestionnaires'; end if;
  if coalesce(trim(p_body_fr),'') = '' and coalesce(trim(p_body_ar),'') = '' then raise exception 'Message vide'; end if;
  insert into public.user_notifications(ziyara_id, recipient_member_id, type, title_fr, title_ar, body_fr, body_ar, payload)
  select p_ziyara_id, gm.id, 'reminder',
         coalesce(nullif(trim(p_title_fr),''), 'Rappel'),
         coalesce(nullif(trim(p_title_ar),''), nullif(trim(p_title_fr),''), 'تذكير'),
         coalesce(nullif(trim(p_body_fr),''), p_body_ar),
         coalesce(nullif(trim(p_body_ar),''), p_body_fr),
         jsonb_build_object('by', auth.uid())
  from public.group_members gm
  where gm.ziyara_id = p_ziyara_id and gm.user_id <> auth.uid()
    and (p_member_ids is null or gm.id = any(p_member_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- 3. Création d'un voyage (avec copie éventuelle des zikr et des membres d'un voyage existant)
create or replace function public.create_ziyara(
  p_title_fr text, p_title_ar text, p_city text, p_timezone text, p_start date, p_end date,
  p_copy_from uuid default null, p_copy_members boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; me record; src uuid := p_copy_from;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if src is not null and not public.is_cheikh(src) then raise exception 'Réservé aux gestionnaires du voyage source'; end if;
  if src is null and not exists (select 1 from public.group_members where user_id = auth.uid() and role = 'cheikh') then
    raise exception 'Réservé aux gestionnaires';
  end if;
  if p_end < p_start then raise exception 'Dates invalides'; end if;

  select * into me from public.group_members where user_id = auth.uid() and role = 'cheikh'
    order by (ziyara_id = src) desc nulls last, created_at limit 1;

  insert into public.ziyaras(title_fr, title_ar, city, timezone, start_date, end_date, is_active)
  values (p_title_fr, p_title_ar, p_city, coalesce(p_timezone, 'Africa/Casablanca'), p_start, p_end, false)
  returning id into new_id;

  insert into public.group_members(ziyara_id, user_id, phone_e164, full_name, role, must_change_password, preferred_lang)
  values (new_id, auth.uid(), me.phone_e164, me.full_name, 'cheikh', false, me.preferred_lang);

  if src is not null then
    insert into public.zikr_definitions(ziyara_id, name_fr, name_ar, arabic_text, scope, default_slot, sort_order, distribution_mode, slot_plan, carry_over)
    select new_id, name_fr, name_ar, arabic_text, scope, default_slot, sort_order, distribution_mode, slot_plan, carry_over
    from public.zikr_definitions where ziyara_id = src;

    if p_copy_members then
      insert into public.group_members(ziyara_id, user_id, phone_e164, full_name, role, must_change_password, preferred_lang)
      select new_id, user_id, phone_e164, full_name, role, false, preferred_lang
      from public.group_members where ziyara_id = src and user_id <> auth.uid();
    end if;
  end if;
  return new_id;
end $$;

-- 4. Voyage actif (celui que voient les membres)
create or replace function public.set_active_ziyara(p_ziyara_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Réservé aux gestionnaires'; end if;
  update public.ziyaras set is_active = false where is_active;
  update public.ziyaras set is_active = true where id = p_ziyara_id;
end $$;

-- 5. Suivi global : une ligne par (voyage géré, membre)
create or replace function public.global_progress()
returns table(ziyara_id uuid, ziyara_title_fr text, start_date date, member_id uuid, user_id uuid, phone_e164 text, full_name text, target bigint, done bigint)
language sql stable security definer set search_path = public as $$
  select z.id, z.title_fr, z.start_date, gm.id, gm.user_id, gm.phone_e164, gm.full_name,
    coalesce((select sum(greatest(0, g.initial_target + g.adjusted_delta)) from public.member_goals g where g.member_id = gm.id), 0)::bigint,
    coalesce((select sum(e.quantity) from public.zikr_entries e where e.member_id = gm.id and e.source = 'personal' and e.status = 'active'), 0)::bigint
  from public.ziyaras z
  join public.group_members gm on gm.ziyara_id = z.id
  where public.is_cheikh(z.id)
  order by z.start_date, gm.full_name;
$$;

revoke all on function public.send_reminder(uuid, uuid[], text, text, text, text), public.create_ziyara(text,text,text,text,date,date,uuid,boolean), public.set_active_ziyara(uuid), public.global_progress() from public, anon;
grant execute on function public.send_reminder(uuid, uuid[], text, text, text, text), public.create_ziyara(text,text,text,text,date,date,uuid,boolean), public.set_active_ziyara(uuid), public.global_progress() to authenticated;
