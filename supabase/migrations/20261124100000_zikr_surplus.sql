-- Surplus par zikr : ce que les membres ont fait au-delà de leur objectif (vue gestionnaire).
create or replace function public.zikr_surplus(p_ziyara_id uuid)
returns table (zikr_id uuid, member_id uuid, full_name text, target bigint, done bigint, surplus bigint)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_cheikh(p_ziyara_id) then raise exception 'Action réservée au gestionnaire'; end if;
  return query
  select g.zikr_id, g.member_id, m.full_name,
         sum(g.initial_target + g.adjusted_delta)::bigint,
         sum(public.goal_done(g.ziyara_id, g.member_id, g.zikr_id, g.target_date))::bigint,
         sum(greatest(0, public.goal_done(g.ziyara_id, g.member_id, g.zikr_id, g.target_date) - (g.initial_target + g.adjusted_delta)))::bigint
  from public.member_goals g join public.group_members m on m.id = g.member_id
  where g.ziyara_id = p_ziyara_id
  group by g.zikr_id, g.member_id, m.full_name
  having sum(greatest(0, public.goal_done(g.ziyara_id, g.member_id, g.zikr_id, g.target_date) - (g.initial_target + g.adjusted_delta))) > 0;
end $$;
revoke all on function public.zikr_surplus(uuid) from public, anon;
grant execute on function public.zikr_surplus(uuid) to authenticated;
