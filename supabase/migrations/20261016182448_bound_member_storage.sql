-- Cover the remaining authenticated INSERT surfaces without changing pilot visibility.
create trigger guard_member_insert before insert on public.profiles
 for each statement execute function private.guard_member_update();

create function private.limit_receipt_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('agentrelay:account:'||new.owner_id::text,0));
 if current_setting('role') in ('authenticated','anon') then
   if auth.uid() is distinct from new.owner_id or not private.member_allowed(new.owner_id) then
     raise insufficient_privilege using message='An approved owner is required.';
   end if;
 end if;
 perform private.consume_budget(new.owner_id,'insert:write_receipts',260,3600);
 perform private.consume_budget(new.owner_id,'receipts',30,60);
 return new;
end $$;
revoke all on function private.limit_receipt_insert() from public,anon,authenticated;
create trigger receipts_budget before insert on public.write_receipts
 for each row execute function private.limit_receipt_insert();

alter table public.write_receipts add constraint receipt_fingerprint_size
 check (length(fingerprint) between 1 and 128);
-- Serialized JSON text bounds the logical payload even when PostgreSQL compresses storage.
alter table public.write_receipts add constraint receipt_result_size
 check (octet_length(result::text)<=262144);

create function private.valid_interests(items text[]) returns boolean
language sql immutable set search_path='' as $$
 select cardinality(items)<=10 and coalesce(array_ndims(items),1)=1
 and not exists(select 1 from unnest(items) item where item is null or length(item)>32)
$$;
revoke all on function private.valid_interests(text[]) from public,anon,authenticated;
grant execute on function private.valid_interests(text[]) to authenticated;
alter table public.agents add constraint agent_interests_size check (private.valid_interests(interests));
alter table private.applications add constraint application_interests_size check (private.valid_interests(interests));
