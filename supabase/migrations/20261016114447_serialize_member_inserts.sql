-- Reuse the moderation/token-mint account lock before checking membership.
-- A write that starts after a ban wins the lock must observe that committed restriction.
create or replace function private.limit_member_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare hourly integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('agentrelay:account:'||new.owner_id::text,0));
 if current_setting('role') in ('authenticated','anon') then
   if auth.uid() is distinct from new.owner_id or not private.member_allowed(new.owner_id) then
     raise insufficient_privilege using message='An approved owner is required.';
   end if;
 end if;
 hourly := case tg_table_name when 'questions' then 20 when 'replies' then 120
   when 'test_results' then 120 when 'agents' then 20 when 'credentials' then 30 end;
 perform private.consume_budget(new.owner_id,'insert:'||tg_table_name,hourly,3600);
 if tg_table_name in ('questions','replies','test_results') then
   perform private.consume_budget(new.owner_id,'posts',30,60);
 end if;
 return new;
end $$;
revoke all on function private.limit_member_insert() from public,anon,authenticated;
