-- Synthetic UUIDs only; run inside a transaction that is always rolled back.
create temporary table privacy_test_ids as select gen_random_uuid() a,gen_random_uuid() b,
 gen_random_uuid() qa,gen_random_uuid() qb,gen_random_uuid() ra,gen_random_uuid() rb,
 gen_random_uuid() app,gen_random_uuid() report;
create temporary table privacy_assertions(name text primary key,passed boolean not null check(passed));
grant select on privacy_test_ids to authenticated;
grant insert,select on privacy_assertions to authenticated;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
 select a,a::text||'@example.invalid',now(),now(),now() from privacy_test_ids union all
 select b,b::text||'@example.invalid',now(),now(),now() from privacy_test_ids;
insert into private.pilot_emails select a::text||'@example.invalid' from privacy_test_ids union all
 select b::text||'@example.invalid' from privacy_test_ids;
insert into public.profiles(id,display_name) select a,'Synthetic removable person' from privacy_test_ids union all
 select b,'Synthetic preserved person' from privacy_test_ids;
insert into public.agents(owner_id,name,description,client,model,interests)
 select a,'Synthetic agent','Private description','SQL','Declared model',array['private'] from privacy_test_ids;
insert into private.credentials(owner_id,agent_id,token_hash,scopes,expires_at)
 select a,g.id,a::text,array['read'],now()+interval '1 day' from privacy_test_ids join public.agents g on g.owner_id=a;
insert into public.questions(id,owner_id,request_id,title,body)
 select qa,a,gen_random_uuid(),'Synthetic removable question','Private question content' from privacy_test_ids union all
 select qb,b,gen_random_uuid(),'Synthetic preserved question','Keep this question intact' from privacy_test_ids;
insert into public.replies(id,question_id,owner_id,request_id,body)
 select ra,qb,a,gen_random_uuid(),'Private suggested solution' from privacy_test_ids union all
 select rb,qa,b,gen_random_uuid(),'Keep this answer intact' from privacy_test_ids;
insert into public.test_results(question_id,reply_id,owner_id,request_id,outcome,environment,evidence)
 select qa,rb,a,gen_random_uuid(),'passed','SQL','Private evidence' from privacy_test_ids union all
 select qb,ra,b,gen_random_uuid(),'passed','SQL','Keep this evidence intact' from privacy_test_ids;
update public.questions q set status='solved',accepted_reply_id=case when q.id=i.qa then i.rb else i.ra end
 from privacy_test_ids i where q.id in(i.qa,i.qb);
insert into private.applications(id,owner_id,display_name,use_case,client,github_url,status,updated_at)
 select app,a,'Synthetic private applicant','Private technical application context','SQL','https://github.com/synthetic','approved',now()-interval '91 days' from privacy_test_ids;
insert into private.application_emails(application_id,version,recipient,decision,state)
 select app,1,a::text||'@example.invalid','approved','sent' from privacy_test_ids;
insert into private.content_reports(id,reporter_id,kind,target_id,target_owner,question_id,category,explanation)
 select report,b,'reply',ra,a,qb,'other','Private context about removable member' from privacy_test_ids;
insert into private.staff_audit(actor_id,actor_role,action,target_id,reason,before_state,after_state)
 select b,'operator','decide_application',app,'Private moderation reason',null,jsonb_build_object('id',app,'use_case','Private technical application context') from privacy_test_ids;
insert into private.community_receipts(owner_id,request_id,fingerprint,result)
 select b,gen_random_uuid(),'keep-fingerprint',jsonb_build_object('id',app,'use_case','Private technical application context') from privacy_test_ids;
insert into public.write_receipts(owner_id,request_id,fingerprint,result)
 select a,gen_random_uuid(),'keep-own-fingerprint',jsonb_build_object('id',qa,'body','Private question content') from privacy_test_ids;
select set_config('agentrelay.privacy_owner',a::text,true) from privacy_test_ids;
