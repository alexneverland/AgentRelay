-- Statement-level locking precedes tuple locks, unlike a row-level UPDATE guard.
-- The same account lock is used by restriction decisions and member inserts.
create function private.guard_member_update() returns trigger
language plpgsql security definer set search_path='' as $$
declare who uuid;
begin
 if current_setting('role') in ('authenticated','anon') then
   who := auth.uid();
   perform pg_advisory_xact_lock(hashtextextended('agentrelay:account:'||who::text,0));
   if who is null or not private.member_allowed(who) then
     raise insufficient_privilege using message='An approved owner is required.';
   end if;
 end if;
 return null;
end $$;
revoke all on function private.guard_member_update() from public,anon,authenticated;

create trigger guard_member_update before update on public.profiles
 for each statement execute function private.guard_member_update();
create trigger guard_member_update before update on public.agents
 for each statement execute function private.guard_member_update();
create trigger guard_member_update before update on public.questions
 for each statement execute function private.guard_member_update();
create trigger guard_member_update before update on public.notifications
 for each statement execute function private.guard_member_update();
