// Rollback-only decision-mail checks. Never sends email or changes the real Master.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from '../src/lib/db';
import { executeAdmin } from '../src/lib/admin-service';
import { requireStaff } from '../src/lib/access';

assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
);
const rollback = new Error('intentional_fixture_rollback');
let assertions = 0;
try {
  await sql.begin(async (db) => {
    const owner = randomUUID(),
      application = randomUUID(),
      email = `decision-${owner}@example.test`;
    await db`insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values(${owner},${email},now(),now(),now())`;
    await db`insert into private.applications(id,owner_id,display_name,use_case,client,status,version) values(${application},${owner},'Synthetic applicant','Synthetic use case for rollback-only email verification.','Test client','approved',2)`;
    await db`insert into private.pilot_emails(email) values(${email})`;
    await db`insert into private.staff_roles(owner_id,role) values(${owner},'moderator')`;
    await assert.rejects(requireStaff({ owner, agent: null, scopes: [] }, 'applications', db));
    assertions++;
    await assert.rejects(
      requireStaff({ owner, agent: randomUUID(), scopes: ['*'] }, 'applications', db),
    );
    assertions++;
    const [rls] =
      await db`select relrowsecurity enabled from pg_class where oid='private.application_emails'::regclass`;
    assert.equal(rls.enabled, true);
    assertions++;
    for (const role of ['anon', 'authenticated']) {
      const [privilege] =
        await db`select has_table_privilege(${role},'private.application_emails','select,insert,update,delete') allowed`;
      assert.equal(privilege.allowed, false);
      assertions++;
    }
    await db`insert into private.application_emails(application_id,version,recipient,decision) values(${application},2,${email},'approved')`;
    const duplicate =
      await db`insert into private.application_emails(application_id,version,recipient,decision) values(${application},2,${email},'approved') on conflict do nothing returning application_id`;
    assert.equal(duplicate.length, 0);
    assertions++;
    const claim = () =>
      db`update private.application_emails set state='sending',attempts=attempts+1 where application_id=${application} and version=2 and state='pending' returning application_id`;
    assert.equal((await claim()).length, 1);
    assertions++;
    assert.equal((await claim()).length, 0);
    assertions++;
    await db`update private.application_emails set state='sent' where application_id=${application} and version=2`;
    assert.equal((await claim()).length, 0);
    assertions++;
    await db`update private.application_emails set state='unknown' where application_id=${application} and version=2`;
    assert.equal((await claim()).length, 0);
    assertions++;
    await db`update private.application_emails set state='failed' where application_id=${application} and version=2`;
    assert.equal((await claim()).length, 0);
    assertions++;
    await db`update private.application_emails set state='pending' where application_id=${application} and version=2 and state='failed'`;
    assert.equal((await claim()).length, 1);
    assertions++;
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}
// Missing or non-human principals cannot dispatch or retry mail, even with valid input.
const input = {
  request_id: randomUUID(),
  application_id: randomUUID(),
  version: 2,
  reason: 'Synthetic permission verification.',
};
for (const principal of [
  { owner: randomUUID(), agent: null, scopes: [] },
  { owner: randomUUID(), agent: randomUUID(), scopes: ['*'], credential: randomUUID() },
]) {
  await assert.rejects(
    executeAdmin('retry_application_email', input, principal),
    (error: unknown) =>
      Boolean(error && typeof error === 'object' && 'status' in error && error.status === 403),
  );
  assertions++;
}
await sql.end();
console.log({ assertions, passed: true, fixtures: 'rolled back', emailsSent: 0 });
