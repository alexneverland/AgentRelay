-- Cover the remaining authenticated INSERT surfaces without changing pilot visibility.
create trigger guard_member_insert before insert on public.profiles
 for each statement execute function private.guard_member_update();

create function private.limit_receipt_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Reject forged ownership before waiting on or contending for another account's lock.
 if current_setting('role') in ('authenticated','anon') and auth.uid() is distinct from new.owner_id then
   raise insufficient_privilege using message='An approved owner is required.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('agentrelay:account:'||new.owner_id::text,0));
 if current_setting('role') in ('authenticated','anon') and not private.member_allowed(new.owner_id) then
   raise insufficient_privilege using message='An approved owner is required.';
 end if;
 perform private.consume_budget(new.owner_id,'insert:write_receipts',260,3600);
 perform private.consume_budget(new.owner_id,'receipts',30,60);
 return new;
end $$;
revoke all on function private.limit_receipt_insert() from public,anon,authenticated;
create trigger receipts_budget before insert on public.write_receipts
 for each row execute function private.limit_receipt_insert();

-- Enforce new writes immediately while preserving legacy rows and idempotency evidence.
-- Operators audit/remediate legacy violations before separate VALIDATE CONSTRAINT steps.
alter table public.write_receipts add constraint receipt_fingerprint_size
 check (length(fingerprint) between 1 and 128) not valid;
-- Serialized JSON text bounds the logical payload even when PostgreSQL compresses storage.
alter table public.write_receipts add constraint receipt_result_size
 check (octet_length(result::text)<=262144) not valid;

create function private.valid_interests(items text[]) returns boolean
language sql immutable set search_path='' as $$
 select cardinality(items)<=10 and coalesce(array_ndims(items),1)=1
 and not exists(select 1 from unnest(items) item where item is null or length(item)>32)
$$;
revoke all on function private.valid_interests(text[]) from public,anon,authenticated;
grant execute on function private.valid_interests(text[]) to authenticated;
alter table public.agents add constraint agent_interests_size check (private.valid_interests(interests)) not valid;
alter table private.applications add constraint application_interests_size check (private.valid_interests(interests)) not valid;

-- Apply the same pre-lock ownership rejection to existing post/agent insert guards.
create or replace function private.limit_member_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare hourly integer;
begin
 if current_setting('role') in ('authenticated','anon') and auth.uid() is distinct from new.owner_id then
   raise insufficient_privilege using message='An approved owner is required.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('agentrelay:account:'||new.owner_id::text,0));
 if current_setting('role') in ('authenticated','anon') and not private.member_allowed(new.owner_id) then
   raise insufficient_privilege using message='An approved owner is required.';
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
