-- Correctifs issus de la revue de code (1)

-- 1. SÉCURITÉ : un membre ne peut plus modifier son rôle ni son rattachement.
revoke update on public.group_members from anon, authenticated;
grant update (full_name, must_change_password, preferred_lang, reminder_prefs)
  on public.group_members to authenticated;

-- 2. Realtime : tables écoutées par le tableau de bord et les notifications.
do $$ begin
  alter publication supabase_realtime add table public.zikr_entries;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.member_goals;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.common_pots;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.user_notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- 3. Synchronisation : une mutation invalide ne bloque plus tout le lot.
create or replace function public.sync_member_batch(p_ziyara_id uuid, p_mutations jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_member_id uuid;
  v_mut jsonb;
  v_processed_ids jsonb := '[]'::jsonb;
  v_failed jsonb := '[]'::jsonb;
  v_mut_id uuid;
  v_type text;
  v_zikr uuid;
begin
  v_member_id := public.current_member_id(p_ziyara_id);
  if v_member_id is null then
    raise exception 'Membre non autorisé pour ce séjour';
  end if;

  for v_mut in select * from jsonb_array_elements(p_mutations)
  loop
    begin
      v_mut_id := (v_mut->>'client_mutation_id')::uuid;
      v_type := v_mut->>'type';

      if v_type = 'create_entry' then
        v_zikr := (v_mut->>'zikr_id')::uuid;
        if not exists (
          select 1 from public.zikr_definitions
          where id = v_zikr and ziyara_id = p_ziyara_id
        ) then
          raise exception 'Zikr inconnu pour ce séjour';
        end if;

        insert into public.zikr_entries (
          client_mutation_id, ziyara_id, member_id, zikr_id,
          entry_date, source, quantity, created_at_client
        ) values (
          v_mut_id, p_ziyara_id, v_member_id, v_zikr,
          (v_mut->>'entry_date')::date,
          coalesce((v_mut->>'source')::entry_source, 'personal'),
          (v_mut->>'quantity')::bigint,
          (v_mut->>'created_at_client')::timestamptz
        )
        on conflict (client_mutation_id) do nothing;

      elsif v_type = 'cancel_entry' then
        update public.zikr_entries
        set status = 'cancelled',
            cancelled_at = now(),
            cancelled_by = v_member_id,
            cancel_reason = coalesce(v_mut->>'reason', 'Annulé par le membre')
        where client_mutation_id = (v_mut->>'target_client_mutation_id')::uuid
          and member_id = v_member_id
          and status = 'active';
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

-- 4. Correction Cheikh : refuse de corriger une saisie déjà annulée.
create or replace function public.cheikh_correct_entry(
  p_entry_id uuid, p_new_quantity bigint, p_reason text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_entry record;
  v_cheikh_id uuid;
  v_new_id uuid;
begin
  select * into v_entry from public.zikr_entries where id = p_entry_id for update;
  if not found then raise exception 'Saisie introuvable'; end if;
  if not public.is_cheikh(v_entry.ziyara_id) then raise exception 'Action réservée au Cheikh'; end if;
  if v_entry.status <> 'active' then raise exception 'Cette saisie est déjà annulée'; end if;

  v_cheikh_id := public.current_member_id(v_entry.ziyara_id);

  if p_new_quantity is not null and p_new_quantity > 0 then
    insert into public.zikr_entries (
      client_mutation_id, ziyara_id, member_id, zikr_id,
      entry_date, source, quantity, created_at_client
    ) values (
      gen_random_uuid(), v_entry.ziyara_id, v_entry.member_id, v_entry.zikr_id,
      v_entry.entry_date, v_entry.source, p_new_quantity, now()
    ) returning id into v_new_id;
  end if;

  update public.zikr_entries
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_cheikh_id,
      cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Corrigé par le Cheikh'),
      replaced_by_entry_id = v_new_id
  where id = p_entry_id;
end;
$$;

-- 5. Annulation d'une redistribution par le Cheikh.
create or replace function public.cancel_redistribution(p_redistribution_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_cheikh_id uuid;
  v_done bigint;
  v_goal record;
  v_pot record;
begin
  select * into r from public.goal_redistributions where id = p_redistribution_id for update;
  if not found then raise exception 'Redistribution introuvable'; end if;
  if not public.is_cheikh(r.ziyara_id) then raise exception 'Action réservée au Cheikh'; end if;
  if r.status <> 'active' then raise exception 'Redistribution déjà annulée'; end if;
  v_cheikh_id := public.current_member_id(r.ziyara_id);

  if r.mode = 'pot' then
    select * into v_pot from public.common_pots
    where ziyara_id = r.ziyara_id and zikr_id = r.zikr_id
      and coalesce(target_date,'1970-01-01'::date) = coalesce(r.target_date,'1970-01-01'::date)
    for update;
    select coalesce(sum(quantity),0) into v_done from public.zikr_entries
    where ziyara_id = r.ziyara_id and zikr_id = r.zikr_id and source = 'pot' and status = 'active'
      and (r.target_date is null or entry_date = r.target_date);
    if v_pot.allocated_quantity - r.quantity < v_done then
      raise exception 'Impossible : des membres ont déjà effectué une part de ce pot';
    end if;
    update public.common_pots set allocated_quantity = allocated_quantity - r.quantity, updated_at = now()
    where id = v_pot.id;
  else
    select * into v_goal from public.member_goals
    where ziyara_id = r.ziyara_id and member_id = r.to_member_id and zikr_id = r.zikr_id
      and coalesce(target_date,'1970-01-01'::date) = coalesce(r.target_date,'1970-01-01'::date)
    for update;
    select coalesce(sum(quantity),0) into v_done from public.zikr_entries
    where ziyara_id = r.ziyara_id and member_id = r.to_member_id and zikr_id = r.zikr_id
      and source = 'personal' and status = 'active'
      and (r.target_date is null or entry_date = r.target_date);
    if (v_goal.initial_target + v_goal.adjusted_delta - r.quantity) < v_done then
      raise exception 'Impossible : le membre a déjà accompli cette quantité';
    end if;
    update public.member_goals set adjusted_delta = adjusted_delta - r.quantity, updated_at = now()
    where id = v_goal.id;
  end if;

  update public.member_goals set adjusted_delta = adjusted_delta + r.quantity, updated_at = now()
  where ziyara_id = r.ziyara_id and member_id = r.from_member_id and zikr_id = r.zikr_id
    and coalesce(target_date,'1970-01-01'::date) = coalesce(r.target_date,'1970-01-01'::date);

  update public.goal_redistributions
  set status = 'cancelled', cancelled_by = v_cheikh_id, cancelled_at = now(),
      cancel_reason = coalesce(nullif(trim(p_reason),''), 'Annulé par le Cheikh')
  where id = r.id;
end;
$$;

-- 6. Notification automatique quand un objectif est ajouté ou augmenté
--    (les redistributions créent leurs propres notifications : initial_target = 0 ignoré).
create or replace function public.notify_goal_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fr text; v_ar text; v_qty bigint;
begin
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

drop trigger if exists trg_notify_goal_assigned on public.member_goals;
create trigger trg_notify_goal_assigned
after insert or update of initial_target on public.member_goals
for each row execute function public.notify_goal_assigned();
