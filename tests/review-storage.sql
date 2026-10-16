create temporary table review_assertions(name text primary key,passed boolean not null check(passed));
create temporary table review_ids as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() question,gen_random_uuid() reply;
grant select on review_ids to authenticated;
grant select,insert on review_assertions to authenticated;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
select a,a::text||'@example.invalid',now(),now(),now() from review_ids
union all select b,b::text||'@example.invalid',now(),now(),now() from review_ids;
insert into private.pilot_emails(email) select a::text||'@example.invalid' from review_ids
union all select b::text||'@example.invalid' from review_ids;
insert into public.profiles(id,display_name) select a,'Review synthetic A' from review_ids
union all select b,'Review synthetic B' from review_ids;
insert into public.agents(owner_id,name,client) select a,'Review synthetic agent','SQL' from review_ids;
insert into public.questions(id,owner_id,request_id,title,body) select question,a,gen_random_uuid(),'Synthetic paginated question','Rollback-only fixture' from review_ids;
insert into public.replies(id,question_id,owner_id,request_id,body) select reply,question,b,gen_random_uuid(),'Rollback-only suggestion' from review_ids;
insert into public.test_results(question_id,reply_id,owner_id,request_id,outcome,environment,evidence,created_at)
select question,reply,a,gen_random_uuid(),case when n=21 then 'passed' else 'failed' end,'Synthetic SQL','Rollback-only evidence',now()+n*interval '1 second'
from review_ids cross join generate_series(1,21) n;
insert into private.applications(owner_id,display_name,use_case,client,status,version)
select a,'Synthetic applicant','Synthetic application cleanup verification','SQL','approved',2 from review_ids;
insert into private.application_emails(application_id,version,recipient,decision)
select id,version,owner_id::text||'@example.invalid','approved' from private.applications where owner_id=(select a from review_ids);

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true) from review_ids;
insert into public.write_receipts(owner_id,request_id,fingerprint,result) select a,gen_random_uuid(),'synthetic-fingerprint','{"ok":true}' from review_ids;
reset role;
insert into review_assertions select 'Legitimate receipt accepted',count(*)=1 from public.write_receipts where owner_id=(select a from review_ids);
set local role authenticated;
do $$ begin
 begin insert into public.write_receipts(owner_id,request_id,fingerprint,result) select a,gen_random_uuid(),repeat('x',129),'{}' from review_ids;
 raise exception 'Oversized fingerprint accepted'; exception when check_violation then insert into review_assertions values('Fingerprint bounded',true); end;
 begin insert into public.write_receipts(owner_id,request_id,fingerprint,result) select a,gen_random_uuid(),'synthetic',to_jsonb(repeat('x',262145)) from review_ids;
 raise exception 'Oversized receipt accepted'; exception when check_violation then insert into review_assertions values('Logical JSON size bounded despite compression',true); end;
 begin insert into public.write_receipts(owner_id,request_id,fingerprint,result) select b,gen_random_uuid(),'synthetic','{}' from review_ids;
 raise exception 'Forged owner accepted'; exception when insufficient_privilege then insert into review_assertions values('Receipt owner enforced',true); end;
 begin update public.agents set interests=array_fill('x'::text,array[11]) where owner_id=(select a from review_ids);
 raise exception 'Too many interests accepted'; exception when check_violation then insert into review_assertions values('Array count bounded on update',true); end;
 begin insert into public.agents(owner_id,name,client,interests) select a,'Oversized interest','SQL',array[repeat('x',33)] from review_ids;
 raise exception 'Long interest accepted'; exception when check_violation then insert into review_assertions values('Array element length bounded on insert',true); end;
 begin update public.agents set interests=array[null::text] where owner_id=(select a from review_ids);
 raise exception 'Null interest accepted'; exception when check_violation then insert into review_assertions values('Null array elements rejected',true); end;
end $$;
update public.agents set interests=array[repeat('α',32)] where owner_id=(select a from review_ids);
insert into review_assertions select 'Unicode interests preserved',interests=array[repeat('α',32)] from public.agents where owner_id=(select a from review_ids);
reset role;
update private.request_budgets set hits=260 where owner_id=(select a from review_ids) and kind='insert:write_receipts';
set local role authenticated;
do $$ begin
 begin insert into public.write_receipts(owner_id,request_id,fingerprint,result) select a,gen_random_uuid(),'synthetic','{}' from review_ids;
 raise exception 'Hourly receipt quota bypassed'; exception when sqlstate 'PT429' then insert into review_assertions values('Receipt hourly budget enforced',true); end;
end $$;
reset role;
update private.request_budgets set hits=1 where owner_id=(select a from review_ids) and kind='insert:write_receipts';
update private.request_budgets set hits=30 where owner_id=(select a from review_ids) and kind='receipts';
set local role authenticated;
do $$ begin
 begin insert into public.write_receipts(owner_id,request_id,fingerprint,result) select a,gen_random_uuid(),'synthetic','{}' from review_ids;
 raise exception 'Minute receipt quota bypassed'; exception when sqlstate 'PT429' then insert into review_assertions values('Receipt minute budget enforced',true); end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true) from review_ids;
insert into public.write_receipts(owner_id,request_id,fingerprint,result) select b,gen_random_uuid(),'synthetic','{}' from review_ids;
reset role;
insert into review_assertions select 'Other owner quota isolated',count(*)=1 from public.write_receipts where owner_id=(select b from review_ids);
insert into private.account_restrictions(owner_id,kind,reason) select a,'ban','Synthetic rollback-only restriction' from review_ids;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true) from review_ids;
do $$ begin
 begin insert into public.profiles(id,display_name) select a,'Blocked profile' from review_ids on conflict do nothing;
 raise exception 'Banned profile insert accepted'; exception when insufficient_privilege then insert into review_assertions values('Banned profile INSERT denied before conflict',true); end;
 begin insert into public.write_receipts(owner_id,request_id,fingerprint,result) select a,gen_random_uuid(),'synthetic','{}' from review_ids;
 raise exception 'Banned receipt accepted'; exception when insufficient_privilege then insert into review_assertions values('Banned receipt INSERT denied',true); end;
end $$;
reset role;
delete from private.account_restrictions where owner_id=(select a from review_ids);
