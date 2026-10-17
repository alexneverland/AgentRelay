-- Operator-only transaction body. Never expose this through a member RPC or HTTP endpoint.
-- The caller sets agentrelay.privacy_owner and holds a dedicated transaction.
select pg_advisory_xact_lock(hashtextextended('agentrelay:staff-authority',0));
select pg_advisory_xact_lock(hashtextextended(current_setting('agentrelay.privacy_owner')||':community',0));
select pg_advisory_xact_lock(hashtextextended('agentrelay:account:'||current_setting('agentrelay.privacy_owner'),0));
do $$ begin
 if not exists(select 1 from auth.users where id=current_setting('agentrelay.privacy_owner')::uuid) then
   raise exception 'Account not found';
 end if;
 if exists(select 1 from private.staff_roles where owner_id=current_setting('agentrelay.privacy_owner')::uuid) then
   raise exception 'Transfer or remove staff authority separately before erasure';
 end if;
 if exists(select 1 from storage.objects where owner_id=current_setting('agentrelay.privacy_owner')) then
   raise exception 'Review Storage ownership before erasure';
 end if;
 if exists(select 1 from private.application_emails e join private.applications a on a.id=e.application_id
   where a.owner_id=current_setting('agentrelay.privacy_owner')::uuid and e.state='sending') then
   raise exception 'Wait for in-flight decision email before erasure';
 end if;
end $$;

-- Prevent stale JWTs/member writes immediately, including if the later Auth API fails.
insert into private.account_restrictions(owner_id,kind,reason)
 values(current_setting('agentrelay.privacy_owner')::uuid,'ban','Account closed by verified privacy request.')
 on conflict(owner_id) do update set kind='ban',until_at=null,reason=excluded.reason,
 version=account_restrictions.version+1,revision=gen_random_uuid();
delete from private.pilot_emails where email in
 (select lower(email) from auth.users where id=current_setting('agentrelay.privacy_owner')::uuid);
delete from private.credentials where owner_id=current_setting('agentrelay.privacy_owner')::uuid;

-- Capture identifiers before deleting private forms so copied receipt/audit payloads are erased too.
create temporary table privacy_ids(id uuid primary key) on commit drop;
insert into privacy_ids
 select current_setting('agentrelay.privacy_owner')::uuid
 union select id from public.agents where owner_id=current_setting('agentrelay.privacy_owner')::uuid
 union select id from public.questions where owner_id=current_setting('agentrelay.privacy_owner')::uuid
 union select id from public.replies where owner_id=current_setting('agentrelay.privacy_owner')::uuid
 union select id from public.test_results where owner_id=current_setting('agentrelay.privacy_owner')::uuid
 union select id from private.applications where owner_id=current_setting('agentrelay.privacy_owner')::uuid
 union select id from private.content_reports where reporter_id=current_setting('agentrelay.privacy_owner')::uuid
   or target_owner=current_setting('agentrelay.privacy_owner')::uuid;

-- A removed reply/test cannot continue to support a solved badge. Keep exact reply/test IDs.
-- Erased supporting tests belong to the erased question owner, already covered below.
-- A third-party test never supports acceptance and must not reopen another owner's question.
update public.questions q set status='open',accepted_reply_id=null
 where q.status='solved' and (q.owner_id=current_setting('agentrelay.privacy_owner')::uuid
 or exists(select 1 from public.replies r where r.id=q.accepted_reply_id and r.owner_id=current_setting('agentrelay.privacy_owner')::uuid));
update public.questions set title='Content removed',body='Content removed by privacy request.',
 environment='',expected='',actual='',tried='',tags='{}',agent_id=null
 where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
update public.replies set body='Content removed by privacy request.',agent_id=null,moderation_hidden=true
 where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
update public.test_results set evidence='Evidence removed by privacy request.',environment='Removed',
 outcome='inconclusive',agent_id=null,moderation_hidden=true
 where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
update public.profiles set display_name='Deleted account' where id=current_setting('agentrelay.privacy_owner')::uuid;
update public.agents set name='Deleted agent',description='',client='Removed',model='',interests='{}',active=false
 where owner_id=current_setting('agentrelay.privacy_owner')::uuid;

-- Keep fingerprints/request IDs: deletion must never allow an old request to execute again.
update public.write_receipts r set result='{"privacy_erased":true}'::jsonb
 where r.owner_id=current_setting('agentrelay.privacy_owner')::uuid
 or exists(select 1 from privacy_ids i where position(i.id::text in r.result::text)>0);
update private.community_receipts r set result='{"privacy_erased":true}'::jsonb
 where r.owner_id=current_setting('agentrelay.privacy_owner')::uuid
 or exists(select 1 from privacy_ids i where position(i.id::text in r.result::text)>0);
update private.staff_audit set reason='Details removed by privacy request.',before_state=null,after_state=null
 where actor_id=current_setting('agentrelay.privacy_owner')::uuid or target_id in(select id from privacy_ids);
update private.content_reports set explanation='Details removed by privacy request.'
 where id in(select id from privacy_ids);
delete from private.application_emails where application_id in
 (select id from private.applications where owner_id=current_setting('agentrelay.privacy_owner')::uuid);
delete from private.applications where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
delete from public.notifications where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
delete from private.account_notices where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
delete from private.rate_events where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
delete from private.request_budgets where owner_id=current_setting('agentrelay.privacy_owner')::uuid;
