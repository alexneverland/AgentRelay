-- Operator-only transaction body. Run daily after reviewing the dry-run counts.
select pg_advisory_xact_lock(hashtextextended('agentrelay:staff-authority',0));
delete from private.rate_events where created_at<now()-interval '24 hours';
delete from private.request_budgets where bucket<now()-interval '24 hours';
delete from public.notifications where created_at<now()-interval '30 days';
delete from private.credentials where least(expires_at,revoked_at)<now()-interval '30 days';

-- Retain application IDs/status/version and mail delivery keys so retries cannot resend decisions.
create temporary table retention_applications(id uuid primary key) on commit drop;
-- Use the same order as membership requests and recheck eligibility after waiting.
do $$ declare candidate uuid; begin
 for candidate in select owner_id from private.applications
 where status<>'pending' and updated_at<now()-interval '90 days' order by owner_id loop
   perform pg_advisory_xact_lock(hashtextextended(candidate::text||':community',0));
   perform pg_advisory_xact_lock(hashtextextended('agentrelay:account:'||candidate::text,0));
 end loop;
end $$;
insert into retention_applications select a.id from private.applications a
 where a.status<>'pending' and a.updated_at<now()-interval '90 days'
 and not exists(select 1 from private.application_emails e where e.application_id=a.id and e.state='sending');
update private.applications set display_name='Former applicant',use_case='Application details removed under retention policy.',
 client='Removed',interests='{}',github_url='',reason=null where id in(select id from retention_applications);
update private.application_emails set recipient='removed@example.invalid',
 state=case when state='sent' then 'sent' else 'cancelled' end
 where application_id in(select id from retention_applications) and state<>'sending';
update private.community_receipts r set result='{"privacy_erased":true}'::jsonb
 where exists(select 1 from retention_applications a where position(a.id::text in r.result::text)>0);
update private.staff_audit set before_state=null,after_state=null,reason='Application details expired.'
 where target_id in(select id from retention_applications);
