import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sql } from '../src/lib/db';

test(
  'Review context retains reported fields and lifting requires a stored restriction',
  { timeout: 90000 },
  async (t) => {
    assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
    assert.equal(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
      `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
    );
    const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
    const people: Array<{ id: string; email: string; jwt: string }> = [];
    const request = async (index: number, path: string, input: unknown, status = 200) => {
      const response = await fetch(`${origin}/api/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${people[index].jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      assert.equal(response.status, status, `${path}: unexpected HTTP status`);
      return response.json();
    };
    const write = () => ({ request_id: randomUUID() });
    try {
      for (let index = 0; index < 2; index++) {
        const id = randomUUID(),
          email = `relay-review-${id}@example.invalid`,
          password = randomBytes(24).toString('hex') + 'aA1!';
        people.push({ id, email, jwt: '' });
        await sql.begin(async (db) => {
          await db`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000',${id},'authenticated','authenticated',${email},extensions.crypt(${password},extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now())`;
          await db`insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${id},${id},${db.json({ sub: id, email, email_verified: true })},'email',now(),now())`;
          await db`insert into private.pilot_emails(email) values(${email})`;
          if (index === 0)
            await db`insert into private.staff_roles(owner_id,role) values(${id},'moderator')`;
        });
        const client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false } },
        );
        const login = await client.auth.signInWithPassword({ email, password });
        assert.ifError(login.error);
        people[index].jwt = login.data.session!.access_token;
      }
      await t.test('Question and test context includes every reported content field', async () => {
        const fields = {
          body: 'Synthetic question details.',
          environment: 'Question environment fixture',
          expected: 'Expected behavior fixture',
          actual: 'Actual behavior fixture',
          tried: 'Previous attempts fixture',
          tags: ['review-context'],
        };
        const question = await request(1, 'relay/create_question', {
          ...write(),
          title: 'Synthetic complete review context',
          ...fields,
        });
        const report = await request(0, 'reports', {
          ...write(),
          kind: 'question',
          target_id: question.id,
          category: 'other',
          explanation: 'Synthetic report covering additional content fields.',
        });
        const context = await request(0, 'admin/report_context', { report_id: report.id });
        for (const value of [
          fields.body,
          fields.environment,
          fields.expected,
          fields.actual,
          fields.tried,
          fields.tags[0],
        ])
          assert.ok(context.body.includes(value), `Missing reported field: ${value}`);
        const reply = await request(1, 'relay/post_reply', {
          ...write(),
          question_id: question.id,
          body: 'Synthetic proposed reply for review.',
        });
        const result = await request(1, 'relay/record_test_result', {
          ...write(),
          question_id: question.id,
          reply_id: reply.id,
          outcome: 'inconclusive',
          environment: 'Distinct test environment fixture',
          evidence: 'Synthetic test evidence fixture.',
        });
        const testReport = await request(0, 'reports', {
          ...write(),
          kind: 'test',
          target_id: result.id,
          category: 'other',
          explanation: 'Synthetic test environment report.',
        });
        const testContext = await request(0, 'admin/report_context', { report_id: testReport.id });
        for (const value of [
          'Distinct test environment fixture',
          'Synthetic test evidence fixture.',
          'inconclusive',
        ])
          assert.ok(testContext.body.includes(value), `Missing reported test field: ${value}`);
      });
      await t.test(
        'Missing restriction creates no notice, audit or receipt; expired restriction can be lifted idempotently',
        async () => {
          const input = {
            ...write(),
            action: 'lift_restriction',
            owner_id: people[1].id,
            expected_revision: null,
            reason: 'Synthetic nonexistent restriction check.',
          };
          await request(0, 'admin/moderate', input, 404);
          const [effects] =
            await sql`select (select count(*)::int from private.account_notices where owner_id=${people[1].id}) notices,(select count(*)::int from private.staff_audit where actor_id=${people[0].id}) audits,(select count(*)::int from private.community_receipts where owner_id=${people[0].id} and request_id=${input.request_id}) receipts`;
          assert.deepEqual({ ...effects }, { notices: 0, audits: 0, receipts: 0 });
          const [restriction] =
            await sql`insert into private.account_restrictions(owner_id,kind,until_at,reason) values(${people[1].id},'suspend',now()-interval '1 hour','Synthetic expired restriction') returning revision`;
          const lift = { ...input, ...write(), expected_revision: restriction.revision };
          await request(0, 'admin/moderate', lift);
          await request(0, 'admin/moderate', lift);
          const [saved] =
            await sql`select (select count(*)::int from private.account_notices where owner_id=${people[1].id} and kind='lift_restriction') notices,(select count(*)::int from private.staff_audit where actor_id=${people[0].id} and action='lift_restriction') audits,(select count(*)::int from private.account_restrictions where owner_id=${people[1].id}) restrictions`;
          assert.deepEqual({ ...saved }, { notices: 1, audits: 1, restrictions: 0 });
        },
      );
    } finally {
      const ids = people.map((p) => p.id),
        emails = people.map((p) => p.email);
      if (ids.length)
        await sql.begin(async (db) => {
          // Exact fixture IDs only; never replace or remove an existing Master.
          await db`delete from private.content_reports where reporter_id=any(${ids}) or target_owner=any(${ids})`;
          await db`delete from private.staff_audit where actor_id=any(${ids})`;
          await db`delete from private.community_receipts where owner_id=any(${ids})`;
          await db`delete from private.rate_events where owner_id=any(${ids})`;
          await db`delete from private.account_notices where owner_id=any(${ids})`;
          await db`delete from private.account_restrictions where owner_id=any(${ids})`;
          await db`delete from private.staff_roles where owner_id=any(${ids})`;
          await db`delete from public.notifications where owner_id=any(${ids}) or question_id in(select id from public.questions where owner_id=any(${ids}))`;
          await db`delete from public.test_results where owner_id=any(${ids})`;
          await db`delete from public.replies where owner_id=any(${ids})`;
          await db`delete from public.questions where owner_id=any(${ids})`;
          await db`delete from public.write_receipts where owner_id=any(${ids})`;
          await db`delete from public.profiles where id=any(${ids})`;
          await db`delete from private.pilot_emails where email=any(${emails})`;
          await db`delete from auth.users where id=any(${ids})`;
        });
      await sql.end();
    }
  },
);
