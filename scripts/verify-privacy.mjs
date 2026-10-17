// Run only against an explicitly operator-authorized hosted test project; never sends email.
import fs from 'node:fs';
import postgres from 'postgres';
import { privacyTarget } from './privacy-core.mjs';

export function privacyVerificationSQL() {
  const read = (file) => fs.readFileSync(file, 'utf8');
  const erase = read('scripts/privacy-erase.sql');
  return `begin;
set local lock_timeout='5s'; set local statement_timeout='60s';
${read('tests/privacy-fixture.sql')}
${read('tests/privacy-resolution.sql')}
-- Simulate pending SMTP work: erasure must stop before changing application data.
update private.application_emails set state='sending' where application_id in(select app from privacy_test_ids);
do $mailguard$ begin
 begin execute $mailerase$${erase}$mailerase$;
 raise exception 'Sending guard failed';
 exception when raise_exception then
 if SQLERRM<>'Wait for in-flight decision email before erasure' then raise; end if;
 end;
end $mailguard$;
insert into privacy_assertions select 'In-flight mail guard preserves application',count(*)=1 from private.applications where id in(select app from privacy_test_ids);
update private.application_emails set state='sent' where application_id in(select app from privacy_test_ids);
-- A staff account must fail before any row changes.
insert into private.staff_roles(owner_id,role) select a,'moderator' from privacy_test_ids;
do $guard$ begin
 begin execute $erase$${erase}$erase$;
 raise exception 'Staff guard failed';
 exception when raise_exception then
 if SQLERRM<>'Transfer or remove staff authority separately before erasure' then raise; end if;
 end;
end $guard$;
insert into privacy_assertions select 'Staff guard preserves profile',display_name='Synthetic removable person' from public.profiles p join privacy_test_ids i on p.id=i.a;
delete from private.staff_roles where owner_id in(select a from privacy_test_ids);
${erase}
insert into privacy_assertions select 'Unrelated third-party tests do not reopen a solved question',
 q.status='solved' and q.accepted_reply_id=r.reply from public.questions q join privacy_unrelated_resolution r on q.id=r.question;
insert into privacy_assertions select 'Actual owner passing evidence remains unchanged',
 t.outcome='passed' and t.evidence='Owner evidence supporting acceptance' and not t.moderation_hidden
 from public.test_results t join privacy_unrelated_resolution r on t.reply_id=r.reply
 join privacy_test_ids i on t.owner_id=i.b;
${read('tests/privacy-erasure-assertions.sql')}
rollback;`;
}

export function retentionVerificationSQL() {
  const read = (file) => fs.readFileSync(file, 'utf8');
  return `begin; set local lock_timeout='5s'; set local statement_timeout='60s';
${read('tests/privacy-fixture.sql')}
insert into private.rate_events(owner_id,kind,created_at) select a,'old',now()-interval '25 hours' from privacy_test_ids
union all select a,'recent',now()-interval '23 hours' from privacy_test_ids;
insert into public.notifications(owner_id,question_id,kind,created_at) select a,qa,'old',now()-interval '31 days' from privacy_test_ids
union all select a,qa,'recent',now()-interval '29 days' from privacy_test_ids;
insert into private.credentials(owner_id,agent_id,token_hash,scopes,expires_at,revoked_at)
select a,g.id,a::text||'-old',array['read'],now()+interval '1 day',now()-interval '31 days' from privacy_test_ids join public.agents g on g.owner_id=a;
${read('scripts/retention-cleanup.sql')}
insert into privacy_assertions select 'Old counters pruned; recent counters preserved',
 not exists(select 1 from private.rate_events where owner_id=a and kind='old')
 and exists(select 1 from private.rate_events where owner_id=a and kind='recent') from privacy_test_ids;
insert into privacy_assertions select 'Old notifications pruned; recent notifications preserved',
 not exists(select 1 from public.notifications where owner_id=a and kind='old')
 and exists(select 1 from public.notifications where owner_id=a and kind='recent') from privacy_test_ids;
insert into privacy_assertions select 'Old revoked token pruned; active token preserved',count(*)=1 and bool_and(revoked_at is null) from private.credentials where owner_id in(select a from privacy_test_ids);
insert into privacy_assertions select 'Application identifiers and status kept without form text',client='Removed' and status='approved' and version=1 and github_url='' and reason is null from private.applications where id in(select app from privacy_test_ids);
insert into privacy_assertions select 'Recipient removed; sent delivery cannot replay',recipient='removed@example.invalid' and state='sent' and version=1 from private.application_emails where application_id in(select app from privacy_test_ids);
insert into privacy_assertions select 'Copied application receipt scrubbed',result='{"privacy_erased":true}'::jsonb and fingerprint='keep-fingerprint' from private.community_receipts where owner_id in(select b from privacy_test_ids);
insert into privacy_assertions select 'Copied application audit scrubbed',after_state is null and before_state is null from private.staff_audit where target_id in(select app from privacy_test_ids);
insert into privacy_assertions select 'Retention preserves member content and access',private.member_allowed(a) and exists(select 1 from public.questions where id=qa and body='Private question content') from privacy_test_ids;
-- A renewed pending form is never erased by its historical decision age.
update private.applications set status='pending',client='Preserve pending',use_case='Preserve newly submitted application details' where id in(select app from privacy_test_ids);
drop table retention_applications;
${read('scripts/retention-cleanup.sql')}
insert into privacy_assertions select 'Pending application preserved',client='Preserve pending' from private.applications where id in(select app from privacy_test_ids);
select jsonb_build_object('retention_passed',count(*),'failed',count(*) filter(where not passed)) verification from privacy_assertions;
rollback;`;
}

if (process.argv.includes('--emit-sql')) {
  process.stdout.write(
    process.argv.includes('--retention') ? retentionVerificationSQL() : privacyVerificationSQL(),
  );
} else {
  privacyTarget(process.env);
  if (process.env.AGENTRELAY_TEST_PROJECT_REF !== process.env.AGENTRELAY_PRIVACY_PROJECT_REF)
    throw new Error('Explicit test and privacy project refs must agree.');
  const db = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    ssl: { ca: fs.readFileSync('certs/supabase-ca.crt', 'utf8'), rejectUnauthorized: true },
  });
  try {
    const results = await db
      .unsafe(
        process.argv.includes('--retention')
          ? retentionVerificationSQL()
          : privacyVerificationSQL(),
      )
      .simple();
    for (const result of results) if (result[0]?.verification) console.log(result[0].verification);
  } catch {
    console.error('Privacy rollback verification failed; inspect privately.');
    process.exitCode = 1;
  } finally {
    await db.end({ timeout: 5 });
  }
}
