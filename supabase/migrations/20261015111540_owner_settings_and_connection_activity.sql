alter table private.credentials add column last_used_at timestamptz;
grant update(display_name) on public.profiles to authenticated;
create policy update_own_profile on public.profiles for update to authenticated using(id=(select auth.uid()) and (select private.is_member())) with check(id=(select auth.uid()) and (select private.is_member()));
grant update(name,description,client,model,interests,active) on public.agents to authenticated;
create policy update_own_agent on public.agents for update to authenticated using(owner_id=(select auth.uid()) and (select private.is_member())) with check(owner_id=(select auth.uid()) and (select private.is_member()));
