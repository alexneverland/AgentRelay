-- Executable, rollback-only database tests. No accounts or posts survive.
begin;
create temporary table fixture_ids as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() outsider,gen_random_uuid() agent_a,gen_random_uuid() agent_b,gen_random_uuid() question,gen_random_uuid() other_question,gen_random_uuid() reply;
create temporary table assertions(name text primary key, passed boolean not null check(passed));
grant select on fixture_ids to authenticated,anon;
grant insert,select on assertions to authenticated,anon;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
select a,a::text||'@example.invalid',now(),now(),now() from fixture_ids
union all select b,b::text||'@example.invalid',now(),now(),now() from fixture_ids
union all select outsider,outsider::text||'@example.invalid',now(),now(),now() from fixture_ids;
insert into private.pilot_emails(email) select a::text||'@example.invalid' from fixture_ids union all select b::text||'@example.invalid' from fixture_ids;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true) from fixture_ids;
insert into assertions select 'Invited owner A is a member',private.is_member();
insert into public.profiles(id,display_name) select a,'Test owner A' from fixture_ids;
insert into public.agents(id,owner_id,name,client) select agent_a,a,'Test agent A','MCP SDK A' from fixture_ids;
insert into public.questions(id,owner_id,agent_id,request_id,title,body) select question,a,agent_a,gen_random_uuid(),'[ROLLBACK TEST] A technical question','Test fixture only' from fixture_ids;
insert into public.questions(id,owner_id,request_id,title,body) select other_question,a,gen_random_uuid(),'[ROLLBACK TEST] A different question','Test fixture only' from fixture_ids;
select set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true) from fixture_ids;
insert into public.profiles(id,display_name) select b,'Test owner B' from fixture_ids;
insert into public.agents(id,owner_id,name,client) select agent_b,b,'Test agent B','MCP SDK B' from fixture_ids;
insert into assertions select 'Owner B can read owner A question',exists(select 1 from public.questions where id=(select question from fixture_ids));
do $$ begin
 begin insert into public.replies(question_id,owner_id,request_id,body) select question,a,gen_random_uuid(),'Forged owner' from fixture_ids;
 raise exception 'Owner spoof was accepted'; exception when insufficient_privilege then insert into assertions values('Owner spoof rejected',true); end;
 begin insert into public.replies(question_id,owner_id,agent_id,request_id,body) select question,b,agent_a,gen_random_uuid(),'Forged agent' from fixture_ids;
 raise exception 'Agent spoof was accepted'; exception when foreign_key_violation then insert into assertions values('Foreign agent rejected',true); end;
end $$;
insert into public.replies(id,question_id,owner_id,agent_id,request_id,body) select reply,question,b,agent_b,gen_random_uuid(),'Proposed solution, version 1' from fixture_ids;
do $$ declare changed integer; begin
 update public.questions set status='solved',accepted_reply_id=(select reply from fixture_ids) where id=(select question from fixture_ids);
 get diagnostics changed=row_count;
 insert into assertions values('Cannot resolve another owner question',changed=0);
 begin update public.replies set body='Edited after test' where id=(select reply from fixture_ids);
 raise exception 'Reply edit was accepted'; exception when insufficient_privilege then insert into assertions values('Replies are immutable',true); end;
 begin select * from private.credentials; raise exception 'Private credentials were readable';
 exception when insufficient_privilege then insert into assertions values('Credential hashes are private',true); end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true) from fixture_ids;
insert into assertions select 'Reply notification delivered atomically',exists(select 1 from public.notifications where question_id=(select question from fixture_ids) and kind='replies');
do $$ begin
 begin update public.questions set status='solved',accepted_reply_id=(select reply from fixture_ids) where id=(select question from fixture_ids);
 raise exception 'Unverified solution was accepted'; exception when check_violation then insert into assertions values('Cannot solve without a passing test',true); end;
 begin insert into public.test_results(question_id,reply_id,owner_id,request_id,outcome,environment,evidence) select other_question,reply,a,gen_random_uuid(),'passed','SQL fixture','Wrong thread' from fixture_ids;
 raise exception 'Cross-thread test was accepted'; exception when foreign_key_violation or insufficient_privilege then insert into assertions values('Tests cannot reference another thread reply',true); end;
end $$;
insert into public.test_results(question_id,reply_id,owner_id,request_id,outcome,environment,evidence) select question,reply,a,gen_random_uuid(),'passed','SQL rollback fixture','Database ownership and FK checks executed; not a report of code execution.' from fixture_ids;
update public.questions set status='solved',accepted_reply_id=(select reply from fixture_ids) where id=(select question from fixture_ids);
insert into assertions select 'Owner resolves after a passing test',exists(select 1 from public.questions where id=(select question from fixture_ids) and status='solved');
select set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true) from fixture_ids;
insert into assertions select 'Cannot read another owner inbox',not exists(select 1 from public.notifications where owner_id=(select a from fixture_ids));
do $$ declare changed integer; begin
 update public.notifications set acknowledged=true where owner_id=(select a from fixture_ids);
 get diagnostics changed=row_count;
 insert into assertions values('Cannot acknowledge another owner notifications',changed=0);
end $$;
select set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true) from fixture_ids;
insert into assertions select 'Uninvited account is not a member',not private.is_member();
insert into assertions select 'Uninvited account cannot read pilot data',not exists(select 1 from public.questions);
do $$ begin
 begin insert into public.profiles(id,display_name) select outsider,'Uninvited' from fixture_ids;
 raise exception 'Uninvited insert was accepted'; exception when insufficient_privilege then insert into assertions values('Uninvited writes rejected',true); end;
end $$;
set local role anon;
do $$ begin
 begin perform id from public.questions; raise exception 'Anonymous read was accepted';
 exception when insufficient_privilege then insert into assertions values('Anonymous reads rejected',true); end;
end $$;
reset role;
select * from assertions order by name;
rollback;
