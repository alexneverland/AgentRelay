insert into privacy_assertions select 'Closure blocks membership and deletes allowlist',
 not private.member_allowed(a) and not exists(select 1 from private.pilot_emails where email=a::text||'@example.invalid') from privacy_test_ids;
insert into privacy_assertions select 'Agent tokens erased',not exists(select 1 from private.credentials where owner_id=a) from privacy_test_ids;
insert into privacy_assertions select 'Profile replaced',display_name='Deleted account' from public.profiles p join privacy_test_ids i on p.id=i.a;
insert into privacy_assertions select 'Agent identity erased',not active and description='' and model='' and interests='{}' from public.agents g join privacy_test_ids i on g.owner_id=i.a;
insert into privacy_assertions select 'Own question text erased with searchable content removed',body='Content removed by privacy request.' and environment='' and not (search @@ plainto_tsquery('simple','Private')) from public.questions q join privacy_test_ids i on q.id=i.qa;
insert into privacy_assertions select 'Foreign reply preserved',body='Keep this answer intact' and not moderation_hidden from public.replies r join privacy_test_ids i on r.id=i.rb;
insert into privacy_assertions select 'Foreign question preserved',body='Keep this question intact' from public.questions q join privacy_test_ids i on q.id=i.qb;
insert into privacy_assertions select 'Foreign evidence preserved',evidence='Keep this evidence intact' and outcome='passed' from public.test_results t join privacy_test_ids i on t.reply_id=i.ra;
insert into privacy_assertions select 'Removed reply is hidden tombstone with stable ID',body='Content removed by privacy request.' and moderation_hidden from public.replies r join privacy_test_ids i on r.id=i.ra;
insert into privacy_assertions select 'Removed evidence cannot certify a solution',evidence='Evidence removed by privacy request.' and outcome='inconclusive' and moderation_hidden from public.test_results t join privacy_test_ids i on t.reply_id=i.rb;
insert into privacy_assertions select 'Resolutions reset without deleting threads',count(*)=2 and bool_and(status='open' and accepted_reply_id is null) from public.questions q join privacy_test_ids i on q.id in(i.qa,i.qb);
insert into privacy_assertions select 'Application and mail recipient erased',not exists(select 1 from private.applications where owner_id=a) and not exists(select 1 from private.application_emails where application_id=app) from privacy_test_ids;
insert into privacy_assertions select 'Foreign actor receipt payload scrubbed, fingerprint kept',result='{"privacy_erased":true}'::jsonb and fingerprint='keep-fingerprint' from private.community_receipts r join privacy_test_ids i on r.owner_id=i.b;
insert into privacy_assertions select 'Own receipt payload scrubbed without reopening request ID',result='{"privacy_erased":true}'::jsonb and fingerprint='keep-own-fingerprint' from public.write_receipts r join privacy_test_ids i on r.owner_id=i.a;
insert into privacy_assertions select 'Copied audit payload removed',after_state is null and before_state is null and reason='Details removed by privacy request.' from private.staff_audit s join privacy_test_ids i on s.target_id=i.app;
insert into privacy_assertions select 'Report context removed',explanation='Details removed by privacy request.' from private.content_reports r join privacy_test_ids i on r.id=i.report;
select set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true) from privacy_test_ids;
set local role authenticated;
insert into privacy_assertions select 'Stale member JWT cannot read threads',count(*)=0 from public.questions;
do $$ begin
 begin
  insert into public.replies(question_id,owner_id,request_id,body) select qb,a,gen_random_uuid(),'Must be rejected' from privacy_test_ids;
  raise exception 'Closed account wrote a reply';
 exception when insufficient_privilege then insert into privacy_assertions values('Stale member JWT cannot publish',true);
 end;
end $$;
reset role;
insert into privacy_assertions select 'Other member still authorized',private.member_allowed(b) from privacy_test_ids;
select jsonb_build_object('passed',count(*),'failed',count(*) filter(where not passed)) verification from privacy_assertions;
