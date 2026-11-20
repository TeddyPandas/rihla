-- Retire l'exécution publique/anon des fonctions SECURITY DEFINER (avertissements du linter Supabase).
revoke execute on function public.current_member_id(uuid) from public, anon;
revoke execute on function public.is_cheikh(uuid) from public, anon;
revoke execute on function public.get_group_zikr_summary(uuid) from public, anon;
revoke execute on function public.sync_member_batch(uuid, jsonb) from public, anon;
revoke execute on function public.redistribute_remaining(uuid, uuid, date, uuid, bigint, jsonb) from public, anon;
revoke execute on function public.cheikh_correct_entry(uuid, bigint, text) from public, anon;
revoke execute on function public.cancel_redistribution(uuid, text) from public, anon;
revoke execute on function public.notify_goal_assigned() from public, anon, authenticated;
grant execute on function public.current_member_id(uuid), public.is_cheikh(uuid), public.get_group_zikr_summary(uuid),
  public.sync_member_batch(uuid, jsonb), public.redistribute_remaining(uuid, uuid, date, uuid, bigint, jsonb),
  public.cheikh_correct_entry(uuid, bigint, text), public.cancel_redistribution(uuid, text) to authenticated;
