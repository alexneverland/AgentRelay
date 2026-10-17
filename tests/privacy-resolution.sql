-- A third-party test cannot support another owner's accepted solution.
-- Include all outcomes so even a non-owner passing report cannot revoke acceptance.
create temporary table privacy_unrelated_resolution as select gen_random_uuid() question,gen_random_uuid() reply;
insert into public.questions(id,owner_id,request_id,title,body)
 select r.question,i.b,gen_random_uuid(),'Independent solved question','Preserve this accepted discussion'
 from privacy_unrelated_resolution r cross join privacy_test_ids i;
insert into public.replies(id,question_id,owner_id,request_id,body)
 select r.reply,r.question,i.b,gen_random_uuid(),'Preserve the accepted suggestion'
 from privacy_unrelated_resolution r cross join privacy_test_ids i;
insert into public.test_results(question_id,reply_id,owner_id,request_id,outcome,environment,evidence)
 select r.question,r.reply,i.b,gen_random_uuid(),'passed','Synthetic SQL','Owner evidence supporting acceptance'
 from privacy_unrelated_resolution r cross join privacy_test_ids i;
insert into public.test_results(question_id,reply_id,owner_id,request_id,outcome,environment,evidence)
 select r.question,r.reply,i.a,gen_random_uuid(),outcome,'Synthetic SQL','Unrelated third-party report'
 from privacy_unrelated_resolution r cross join privacy_test_ids i cross join
 unnest(array['passed','failed','inconclusive']) outcome;
update public.questions q set status='solved',accepted_reply_id=r.reply
 from privacy_unrelated_resolution r where q.id=r.question;
