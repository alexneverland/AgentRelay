import { deleteFixtureApplications } from './fixture-cleanup';
// Explicit synthetic browser fixtures; never used by application startup.
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { sql } from '../src/lib/db';

const path = 'output/moderation-ui-fixture.json';
type Person = { id: string; email: string; password: string; role: string };
try {
  assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
  assert.equal(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
  );
  if (process.argv.includes('--cleanup')) {
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as { people: Person[] };
    assert.equal(fixture.people.length, 4);
    for (const person of fixture.people) {
      assert.match(person.email, /^relay-ui-staff-[a-f0-9-]+@example\.invalid$/);
      const [user] = await sql`select email from auth.users where id=${person.id}`;
      assert.equal(user.email, person.email);
    }
    const ids = fixture.people.map((p) => p.id),
      emails = fixture.people.map((p) => p.email);
    await sql.begin(async (db) => {
      await db`delete from private.content_reports where reporter_id=any(${ids}) or target_owner=any(${ids})`;
      await db`delete from private.staff_audit where actor_id=any(${ids}) or target_id=any(${ids})`;
      await db`delete from private.community_receipts where owner_id=any(${ids})`;
      await db`delete from private.rate_events where owner_id=any(${ids})`;
      await db`delete from private.account_notices where owner_id=any(${ids})`;
      await deleteFixtureApplications(db, ids);
      await db`delete from private.account_restrictions where owner_id=any(${ids})`;
      await db`delete from private.staff_roles where owner_id=any(${ids})`;
      await db`delete from public.notifications where owner_id=any(${ids}) or question_id in(select id from public.questions where owner_id=any(${ids}))`;
      await db`delete from public.test_results where owner_id=any(${ids})`;
      await db`delete from public.replies where owner_id=any(${ids})`;
      await db`delete from public.questions where owner_id=any(${ids})`;
      await db`delete from public.write_receipts where owner_id=any(${ids})`;
      await db`delete from private.credentials where owner_id=any(${ids})`;
      await db`delete from public.agents where owner_id=any(${ids})`;
      await db`delete from public.profiles where id=any(${ids})`;
      await db`delete from private.pilot_emails where email=any(${emails})`;
      await db`delete from auth.users where id=any(${ids})`;
    });
    unlinkSync(path);
    console.log('Exact synthetic UI fixtures removed.');
  } else {
    assert.ok(!existsSync(path), 'Clean up the previous fixture first.');
    const [master] = await sql`select owner_id from private.staff_roles where role='master'`;
    assert.ok(
      !master,
      'UI fixtures require an unbootstrapped test instance; never replace its master.',
    );
    const run = crypto.randomUUID().slice(0, 8);
    const people: Person[] = ['master', 'moderator', 'member', 'applicant'].map((role, index) => ({
      role,
      id: crypto.randomUUID(),
      email: `relay-ui-staff-${run}-${index}@example.invalid`,
      password: randomBytes(24).toString('base64url') + 'aA1!',
    }));
    mkdirSync('output', { recursive: true });
    writeFileSync(path, JSON.stringify({ people }));
    await sql.begin(async (db) => {
      for (const person of people) {
        await db`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000',${person.id},'authenticated','authenticated',${person.email},extensions.crypt(${person.password},extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now())`;
        await db`insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${person.id},${person.id},${db.json({ sub: person.id, email: person.email, email_verified: true })},'email',now(),now())`;
        if (person.role !== 'applicant') {
          await db`insert into private.pilot_emails(email) values(${person.email})`;
          await db`insert into public.profiles(id,display_name) values(${person.id},${'[UI TEST] ' + person.role})`;
        }
        if (['master', 'moderator'].includes(person.role))
          await db`insert into private.staff_roles(owner_id,role) values(${person.id},${person.role})`;
      }
      await db`insert into public.questions(owner_id,request_id,title,body) values(${people[2].id},${crypto.randomUUID()},'[UI TEST] Review a synthetic discussion','Synthetic browser test content. No real participant misconduct is alleged.')`;
    });
    console.log('Four synthetic UI actors created; credentials remain in ignored output only.');
  }
} finally {
  await sql.end();
}
