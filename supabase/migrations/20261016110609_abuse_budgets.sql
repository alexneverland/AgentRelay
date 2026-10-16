-- Shared, bounded counters; no IP addresses, tokens or post content are stored.
create table private.request_budgets (
 owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(length(kind) between 1 and 40),
 bucket timestamptz not null,
 hits integer not null check(hits>0),
 primary key(owner_id,kind,bucket)
);
alter table private.request_budgets enable row level security;
revoke all on private.request_budgets from public,anon,authenticated;

-- Only trusted server code and the guarded insert trigger can consume counters.
create function private.consume_budget(p_owner uuid,p_kind text,p_limit integer,p_seconds integer)
returns void language plpgsql security definer set search_path='' as $$
declare t timestamptz := statement_timestamp(); b timestamptz; accepted integer;
begin
 if p_limit<1 or p_seconds not between 1 and 3600 then raise exception 'Invalid budget configuration'; end if;
 b := to_timestamp(floor(extract(epoch from t)/p_seconds)*p_seconds);
 delete from private.request_budgets where owner_id=p_owner and bucket<t-interval '24 hours';
 insert into private.request_budgets(owner_id,kind,bucket,hits) values(p_owner,p_kind,b,1)
 on conflict(owner_id,kind,bucket) do update set hits=request_budgets.hits+1
 where request_budgets.hits<p_limit returning hits into accepted;
 if accepted is null then
   raise sqlstate 'PT429' using message='Too many requests. Please try again later.',
   detail=greatest(1,ceil(extract(epoch from b+make_interval(secs=>p_seconds)-t)))::integer::text;
 end if;
end $$;
revoke all on function private.consume_budget(uuid,text,integer,integer) from public,anon,authenticated;

-- Database enforcement also covers direct Data API INSERTs, not just the website/MCP.
create function private.limit_member_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare hourly integer;
begin
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
create trigger questions_budget before insert on public.questions for each row execute function private.limit_member_insert();
create trigger replies_budget before insert on public.replies for each row execute function private.limit_member_insert();
create trigger tests_budget before insert on public.test_results for each row execute function private.limit_member_insert();
create trigger agents_budget before insert on public.agents for each row execute function private.limit_member_insert();
create trigger credentials_budget before insert on private.credentials for each row execute function private.limit_member_insert();
