-- Exact synthetic cohort only. Set agentrelay.privacy_owner_a/_b in the transaction.
-- Refuse to clean a real account or traverse into another author's discussion.
create temporary table privacy_cleanup_ids(id uuid primary key) on commit drop;
insert into privacy_cleanup_ids values(current_setting('agentrelay.privacy_owner_a')::uuid),
 (current_setting('agentrelay.privacy_owner_b')::uuid);
do $$ begin
 if (select count(*) from privacy_cleanup_ids)<>2 or exists(
   select 1 from auth.users u join privacy_cleanup_ids i on i.id=u.id
   where not coalesce((u.raw_user_meta_data->>'privacy_fixture')::boolean,false) and u.deleted_at is null
 ) then raise exception 'Not this run synthetic Auth cohort'; end if;
 if exists(select 1 from public.replies r join public.questions q on q.id=r.question_id
   where q.owner_id in(select id from privacy_cleanup_ids) and r.owner_id not in(select id from privacy_cleanup_ids))
 or exists(select 1 from public.test_results t join public.questions q on q.id=t.question_id
   where q.owner_id in(select id from privacy_cleanup_ids) and t.owner_id not in(select id from privacy_cleanup_ids))
 then raise exception 'Foreign author content blocks synthetic cleanup'; end if;
end $$;
update public.questions set status='open',accepted_reply_id=null where owner_id in(select id from privacy_cleanup_ids);
delete from private.content_reports where reporter_id in(select id from privacy_cleanup_ids) or target_owner in(select id from privacy_cleanup_ids);
delete from public.notifications where owner_id in(select id from privacy_cleanup_ids);
delete from public.test_results where owner_id in(select id from privacy_cleanup_ids);
delete from public.replies where owner_id in(select id from privacy_cleanup_ids);
delete from public.questions where owner_id in(select id from privacy_cleanup_ids);
delete from public.write_receipts where owner_id in(select id from privacy_cleanup_ids);
delete from private.community_receipts where owner_id in(select id from privacy_cleanup_ids);
delete from private.credentials where owner_id in(select id from privacy_cleanup_ids);
delete from public.agents where owner_id in(select id from privacy_cleanup_ids);
delete from private.staff_audit where actor_id in(select id from privacy_cleanup_ids);
delete from private.application_emails where application_id in(select id from private.applications where owner_id in(select id from privacy_cleanup_ids));
delete from private.applications where owner_id in(select id from privacy_cleanup_ids);
delete from private.account_notices where owner_id in(select id from privacy_cleanup_ids);
delete from private.account_restrictions where owner_id in(select id from privacy_cleanup_ids);
delete from private.request_budgets where owner_id in(select id from privacy_cleanup_ids);
delete from private.rate_events where owner_id in(select id from privacy_cleanup_ids);
delete from private.pilot_emails where email in(select lower(email) from auth.users where id in(select id from privacy_cleanup_ids));
delete from public.profiles where id in(select id from privacy_cleanup_ids);
