create temporary table abuse_assertions(name text primary key,passed boolean not null check(passed));
insert into abuse_assertions select 'Budget table exists',to_regclass('private.request_budgets') is not null;
create temporary table abuse_ids as select gen_random_uuid() a,gen_random_uuid() b;
grant select on abuse_ids to authenticated;
grant insert,select on abuse_assertions to authenticated;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
select a,a::text||'@example.test',now(),now(),now() from abuse_ids
union all select b,b::text||'@example.test',now(),now(),now() from abuse_ids;
insert into private.pilot_emails(email) select a::text||'@example.test' from abuse_ids
union all select b::text||'@example.test' from abuse_ids;
insert into public.profiles(id,display_name) select a,'Synthetic budget owner A' from abuse_ids
union all select b,'Synthetic budget owner B' from abuse_ids;
insert into abuse_assertions select 'RLS enabled',relrowsecurity from pg_class where oid='private.request_budgets'::regclass;
insert into abuse_assertions select 'No authenticated table grants',not has_table_privilege('authenticated','private.request_budgets','select,insert,update,delete');
insert into abuse_assertions select 'No anonymous table grants',not has_table_privilege('anon','private.request_budgets','select,insert,update,delete');
insert into abuse_assertions select 'No authenticated budget RPC',not has_function_privilege('authenticated','private.consume_budget(uuid,text,integer,integer)','execute');
insert into abuse_assertions select 'No anonymous budget RPC',not has_function_privilege('anon','private.consume_budget(uuid,text,integer,integer)','execute');
select private.consume_budget(a,'synthetic',2,3600) from abuse_ids;
select private.consume_budget(a,'synthetic',2,3600) from abuse_ids;
do $$ declare wait_seconds text; begin
 begin perform private.consume_budget((select a from abuse_ids),'synthetic',2,3600); raise exception 'Overflow accepted';
 exception when sqlstate 'PT429' then
   get stacked diagnostics wait_seconds=pg_exception_detail;
   insert into abuse_assertions values('Overflow rejected with bounded delay',wait_seconds::int between 1 and 3600);
 end;
end $$;
select private.consume_budget(b,'synthetic',2,3600) from abuse_ids;
insert into abuse_assertions select 'Other owners isolated',hits=1 from private.request_budgets where owner_id=(select b from abuse_ids) and kind='synthetic';
insert into abuse_assertions select 'Rejected counter does not grow',hits=2 from private.request_budgets where owner_id=(select a from abuse_ids) and kind='synthetic';
insert into private.request_budgets select a,'stale',now()-interval '2 days',1 from abuse_ids;
select private.consume_budget(a,'maintenance',2,3600) from abuse_ids;
insert into abuse_assertions select 'Old owner counters pruned',not exists(select 1 from private.request_budgets where owner_id=(select a from abuse_ids) and kind='stale');

-- Direct authenticated INSERTs still encounter limits; agents cannot gain a new owner budget.
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true) from abuse_ids;
insert into public.agents(owner_id,name,client) select a,'Budget agent A','Synthetic' from abuse_ids;
insert into public.agents(owner_id,name,client) select a,'Budget agent B','Synthetic' from abuse_ids;
insert into public.questions(owner_id,agent_id,request_id,title,body)
select a,(select id from public.agents where owner_id=a order by name limit 1),gen_random_uuid(),'Synthetic question for shared budget','Synthetic rollback-only post' from abuse_ids;
insert into public.questions(owner_id,agent_id,request_id,title,body)
select a,(select id from public.agents where owner_id=a order by name desc limit 1),gen_random_uuid(),'Another synthetic question for shared budget','Synthetic rollback-only post' from abuse_ids;
reset role;
insert into abuse_assertions select 'Agents share owner quota',hits=2 from private.request_budgets where owner_id=(select a from abuse_ids) and kind='insert:questions';
update private.request_budgets set hits=20 where owner_id=(select a from abuse_ids) and kind='insert:questions';
set local role authenticated;
do $$ begin
 begin insert into public.questions(owner_id,request_id,title,body) select a,gen_random_uuid(),'A blocked direct Data API insertion','Synthetic' from abuse_ids;
 raise exception 'Direct insertion bypassed quota'; exception when sqlstate 'PT429' then insert into abuse_assertions values('Direct Data API cannot bypass quota',true); end;
 begin insert into public.questions(owner_id,request_id,title,body) select b,gen_random_uuid(),'A forged owner cannot consume victim quota','Synthetic' from abuse_ids;
 raise exception 'Owner forgery accepted'; exception when insufficient_privilege then insert into abuse_assertions values('Forged owner rejected',true); end;
 begin perform private.consume_budget((select a from abuse_ids),'insert:questions',999999,3600);
 raise exception 'Budget RPC exposed'; exception when insufficient_privilege then insert into abuse_assertions values('Member cannot raise quota',true); end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true) from abuse_ids;
insert into public.questions(owner_id,request_id,title,body) select b,gen_random_uuid(),'Other owner can still post normally','Synthetic' from abuse_ids;
reset role;
insert into abuse_assertions select 'Other owner posts unaffected',count(*)=1 from public.questions where owner_id=(select b from abuse_ids);
