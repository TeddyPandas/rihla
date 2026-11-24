-- Journal des attributions : chaque appel à distribute_zikr / assign_per_person laisse une trace lisible.
create table if not exists public.goal_assignments (
  id uuid primary key default gen_random_uuid(),
  ziyara_id uuid not null references public.ziyaras(id) on delete cascade,
  zikr_id uuid not null references public.zikr_definitions(id) on delete cascade,
  kind text not null check (kind in ('split','per_person')),
  mode text not null,               -- daily | stay | day
  target_date date,
  total bigint not null,            -- ajouté au total du groupe
  per_person bigint,                -- part de chaque participant (par cycle pour per_person)
  participants int not null,
  cycles int not null default 1,
  surplus bigint not null default 0,
  member_ids uuid[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists goal_assignments_ziyara_idx on public.goal_assignments (ziyara_id, created_at desc);
alter table public.goal_assignments enable row level security;
drop policy if exists goal_assignments_select on public.goal_assignments;
create policy goal_assignments_select on public.goal_assignments for select to authenticated using (public.is_cheikh(ziyara_id));
grant select on public.goal_assignments to authenticated;

do $$
declare d text;
begin
  -- distribute_zikr : trace avant le return
  d := pg_get_functiondef('public.distribute_zikr(uuid,uuid,bigint,text,date,uuid[],time_slot)'::regprocedure);
  d := replace(d, 'return jsonb_build_object(''participants'', v_k, ''share_total_per_member''',
    'insert into public.goal_assignments (ziyara_id, zikr_id, kind, mode, target_date, total, per_person, participants, cycles, surplus, member_ids, created_by) '
    || 'values (p_ziyara_id, p_zikr_id, ''split'', p_mode, case when p_mode = ''day'' then p_day end, p_total, v_share_sum, v_k, array_length(v_dates, 1), v_surplus_sum, v_members, v_mgr); '
    || 'return jsonb_build_object(''participants'', v_k, ''share_total_per_member''');
  execute d;

  -- assign_per_person
  d := pg_get_functiondef('public.assign_per_person(uuid,uuid,bigint,text,date,uuid[],jsonb,time_slot)'::regprocedure);
  d := replace(d, 'return jsonb_build_object(''participants'', v_k, ''per_person_per_cycle''',
    'insert into public.goal_assignments (ziyara_id, zikr_id, kind, mode, target_date, total, per_person, participants, cycles, surplus, member_ids, created_by) '
    || 'values (p_ziyara_id, p_zikr_id, ''per_person'', p_mode, case when p_mode = ''day'' then p_day end, v_qty * v_k * array_length(v_dates, 1), v_qty, v_k, array_length(v_dates, 1), 0, v_members, v_mgr); '
    || 'return jsonb_build_object(''participants'', v_k, ''per_person_per_cycle''');
  execute d;

  -- remises à zéro : le journal suit
  d := pg_get_functiondef('public.clear_zikr_goals(uuid)'::regprocedure);
  d := replace(d, 'delete from public.member_goals where zikr_id = p_zikr_id;',
    'delete from public.member_goals where zikr_id = p_zikr_id; delete from public.goal_assignments where zikr_id = p_zikr_id;');
  execute d;
  d := pg_get_functiondef('public.reset_ziyara_data(uuid)'::regprocedure);
  d := replace(d, 'delete from public.member_goals where ziyara_id = p_ziyara_id;',
    'delete from public.member_goals where ziyara_id = p_ziyara_id; delete from public.goal_assignments where ziyara_id = p_ziyara_id;');
  execute d;
end $$;
