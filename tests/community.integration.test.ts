import { deleteFixtureApplications } from '../scripts/fixture-cleanup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { sql } from '../src/lib/db';
import { execute } from '../src/lib/service';
import { executeApplications } from '../src/lib/membership-service';

const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
test(
  'Master, moderator, member and applicant enforce community boundaries',
  { timeout: 180000 },
  async (t) => {
    assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
    assert.equal(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
      `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
    );
    const people: Array<{ id: string; email: string; jwt: string }> = [];
    const run = crypto.randomUUID().slice(0, 8);
    async function request(index: number, path: string, input: unknown = {}, status = 200) {
      const action = input as Record<string, unknown>;
      if (
        path === 'admin/moderate' &&
        ['ban', 'suspend', 'lift_restriction'].includes(String(action.action)) &&
        !('expected_revision' in action)
      ) {
        const [current] =
          await sql`select revision from private.account_restrictions where owner_id=${String(action.owner_id)}`;
        input = { ...action, expected_revision: current?.revision || null };
      }
      const response = await fetch(`${origin}/api/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${people[index].jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      assert.equal(response.status, status, `${path}: unexpected HTTP status`);
      const result = await response.json();
      return result;
    }
    const write = () => ({ request_id: crypto.randomUUID() });
    const [existingMaster] =
      await sql`select owner_id from private.staff_roles where role='master'`;
    assert.ok(
      !existingMaster,
      'Use a separate unbootstrapped test project; never replace the real master to run fixtures.',
    );
    try {
      for (let index = 0; index < 4; index++) {
        const id = crypto.randomUUID(),
          email = `relay-staff-${run}-${index}@example.invalid`,
          password = randomBytes(24).toString('hex') + 'aA1!';
        people.push({ id, email, jwt: '' });
        await sql.begin(async (db) => {
          await db`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000',${id},'authenticated','authenticated',${email},extensions.crypt(${password},extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now())`;
          await db`insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${id},${id},${db.json({ sub: id, email, email_verified: true })},'email',now(),now())`;
          if (index < 3) await db`insert into private.pilot_emails(email) values(${email})`;
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
      // Missing account endpoint is the first RED control, before any staff schema access.
      const pending = await request(3, 'account/status');
      assert.equal(pending.member, false);
      await sql`insert into private.staff_roles(owner_id,role) values(${people[0].id},'master'),(${people[1].id},'moderator')`;
      await request(2, 'admin/summary', {}, 403);
      const anonymous = await fetch(`${origin}/api/account/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(anonymous.status, 401);
      await sql`update auth.users set raw_user_meta_data='{"role":"master"}'::jsonb where id=${people[2].id}`;
      await request(2, 'admin/summary', {}, 403);
      await sql`update auth.users set email_confirmed_at=null where id=${people[3].id}`;
      await request(3, 'account/status', {}, 401);
      await sql`update auth.users set email_confirmed_at=now() where id=${people[3].id}`;
      await request(1, 'admin/applications', {}, 403);
      await request(1, 'admin/users', {}, 403);
      await request(
        1,
        'admin/moderate',
        {
          ...write(),
          action: 'ban',
          owner_id: people[3].id,
          reason: 'Moderator must not target an unapproved applicant.',
        },
        403,
      );
      const input = {
        ...write(),
        display_name: 'Test applicant',
        use_case: 'I want to contribute reproducible TypeScript debugging tests.',
        client: 'Codex',
        interests: ['TypeScript'],
        accepted_rules: true,
      };
      const [application, duplicate] = await Promise.all([
        request(3, 'account/submit_application', input),
        request(3, 'account/submit_application', input),
      ]);
      assert.equal(duplicate.id, application.id);
      const summary = await request(0, 'admin/summary');
      assert.ok(summary.pending_applications >= 1);
      await request(0, 'admin/decide_application', {
        ...write(),
        application_id: application.id,
        version: application.version,
        decision: 'approved',
        reason: 'Approved synthetic test participant.',
      });
      assert.equal((await request(3, 'account/status')).member, true);
      await request(
        0,
        'admin/decide_application',
        {
          ...write(),
          application_id: application.id,
          version: application.version,
          decision: 'declined',
          reason: 'Stale concurrent application decision.',
        },
        409,
      );
      const warningsBefore = (await request(3, 'account/status')).notices;
      assert.ok(warningsBefore.every((n: { kind: string }) => n.kind !== 'warn'));
      const questionInput = {
        ...write(),
        title: `[STAFF TEST ${run}] Controlled moderation example`,
        body: 'Synthetic content for permission and visibility verification.',
      };
      const question = await request(2, 'relay/create_question', questionInput);
      const reportInput = {
        ...write(),
        kind: 'question',
        target_id: question.id,
        category: 'harassment',
        explanation: 'Synthetic report for checking the private moderation queue.',
      };
      const report = await request(3, 'reports', reportInput);
      assert.equal((await request(3, 'reports', reportInput)).id, report.id);
      const modSummary = await request(1, 'admin/summary');
      assert.ok(modSummary.unresolved_reports >= 1);
      assert.ok(!('pending_applications' in modSummary));
      const reportList = await request(1, 'admin/reports');
      assert.ok(!JSON.stringify(reportList).includes(people[3].email));
      assert.ok(!JSON.stringify(reportList).includes('reporter_id'));
      const [existingRates] =
        await sql`select count(*)::int total from private.rate_events where owner_id=${people[3].id} and kind='report'`;
      for (let n = existingRates.total; n < 10; n++)
        await sql`insert into private.rate_events(owner_id,kind) values(${people[3].id},'report')`;
      const rateQuestion = await request(2, 'relay/create_question', {
        ...write(),
        title: '[STAFF TEST] Rate limiting target',
        body: 'Synthetic distinct report target.',
      });
      await request(
        3,
        'reports',
        {
          ...write(),
          kind: 'question',
          target_id: rateQuestion.id,
          category: 'spam',
          explanation: 'This new report must exceed the hourly allowance.',
        },
        429,
      );
      await t.test('Concurrent reports serialize the final hourly slot', async () => {
        await sql`delete from private.rate_events where owner_id=${people[3].id} and kind='report'`;
        for (let n = 0; n < 9; n++)
          await sql`insert into private.rate_events(owner_id,kind) values(${people[3].id},'report')`;
        const other = await request(2, 'relay/create_question', {
          ...write(),
          title: 'Synthetic concurrency report target',
          body: 'Disposable report rate fixture.',
        });
        const results = await Promise.all(
          [rateQuestion.id, other.id].map((target_id) =>
            fetch(`${origin}/api/reports`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${people[3].jwt}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...write(),
                kind: 'question',
                target_id,
                category: 'other',
                explanation: 'Synthetic concurrent hourly slot check.',
              }),
            }),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 429]);
      });
      const updated = await request(1, 'admin/update_report', {
        ...write(),
        report_id: report.id,
        version: 1,
        status: 'reviewing',
        reason: 'Synthetic review has been started.',
      });
      assert.equal(updated.version, 2);
      await request(
        1,
        'admin/update_report',
        {
          ...write(),
          report_id: report.id,
          version: 1,
          status: 'dismissed',
          reason: 'Stale report decision must be rejected.',
        },
        409,
      );
      await request(
        1,
        'admin/moderate',
        {
          ...write(),
          action: 'ban',
          owner_id: people[0].id,
          reason: 'Must reject targeting the master.',
        },
        403,
      );
      await request(
        1,
        'admin/set_moderator',
        {
          ...write(),
          owner_id: people[2].id,
          enabled: true,
          reason: 'Must reject moderator role escalation.',
        },
        403,
      );
      await request(1, 'admin/moderate', {
        ...write(),
        action: 'hide',
        kind: 'question',
        target_id: question.id,
        reason: 'Synthetic content visibility check.',
      });
      await request(2, 'relay/get_thread', { question_id: question.id }, 404);
      const memberClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${people[2].jwt}` } },
          auth: { persistSession: false },
        },
      );
      const hidden = await memberClient.from('questions').select('*').eq('id', question.id);
      assert.ifError(hidden.error);
      assert.deepEqual(hidden.data, []);
      await t.test(
        'Hidden creation receipts neither disclose titles nor republish retries',
        async () => {
          const receipts = await memberClient
            .from('write_receipts')
            .select('result')
            .eq('request_id', questionInput.request_id);
          assert.ifError(receipts.error);
          assert.deepEqual(receipts.data, []);
          await request(2, 'relay/create_question', questionInput, 404);
          const [count] =
            await sql`select count(*)::int total from public.questions where owner_id=${people[2].id} and request_id=${questionInput.request_id}`;
          assert.equal(count.total, 1);
        },
      );
      await t.test('Review distinguishes inherited hiding from own visibility', async () => {
        const [reply] =
          await sql`insert into public.replies(question_id,owner_id,request_id,body) values(${question.id},${people[2].id},${crypto.randomUUID()},'Synthetic dependent reply') returning id`;
        const [childReport] =
          await sql`insert into private.content_reports(reporter_id,kind,target_id,target_owner,question_id,category,explanation) values(${people[3].id},'reply',${reply.id},${people[2].id},${question.id},'other','Synthetic inherited visibility report') returning id`;
        const context = await request(1, 'admin/report_context', { report_id: childReport.id });
        assert.equal(context.own_hidden, false);
        assert.equal(context.hidden, true);
        assert.deepEqual(context.blocking_ancestor, { kind: 'question', id: question.id });
        await request(
          1,
          'admin/moderate',
          {
            ...write(),
            action: 'restore',
            kind: 'reply',
            target_id: reply.id,
            reason: 'Cannot restore through a hidden ancestor.',
          },
          409,
        );
      });
      const privateRead = await memberClient.schema('private').from('content_reports').select('*');
      assert.ok(privateRead.error);
      await request(1, 'admin/moderate', {
        ...write(),
        action: 'restore',
        kind: 'question',
        target_id: question.id,
        reason: 'Restore original synthetic question.',
      });
      assert.equal(
        (await request(2, 'relay/get_thread', { question_id: question.id })).question.id,
        question.id,
      );
      const agent = await request(2, 'relay/create_agent', {
        name: '[STAFF TEST] Member agent',
        client: 'Codex',
      });
      const token = await request(2, 'relay/create_token', {
        agent_id: agent.id,
        scopes: ['read'],
      });
      await t.test('Hidden threads are absent from real MCP search, reads and inbox', async () => {
        await request(3, 'relay/post_reply', {
          ...write(),
          question_id: question.id,
          body: 'Synthetic notification visibility reply.',
        });
        const client = new Client({ name: 'moderation-regression', version: '1.0.0' });
        try {
          await client.connect(
            new StreamableHTTPClientTransport(new URL('/api/mcp', origin), {
              requestInit: { headers: { Authorization: `Bearer ${token.token}` } },
            }),
          );
          await request(1, 'admin/moderate', {
            ...write(),
            action: 'hide',
            kind: 'question',
            target_id: question.id,
            reason: 'Synthetic MCP hidden surface check.',
          });
          const read = await client.callTool({
            name: 'get_thread',
            arguments: { question_id: question.id },
          });
          assert.equal(read.isError, true);
          assert.ok(!JSON.stringify(read).includes(questionInput.title));
          const search = await client.callTool({
            name: 'search_questions',
            arguments: { query: run },
          });
          assert.ok(!JSON.stringify(search).includes(question.id));
          const inbox = await client.callTool({ name: 'get_inbox', arguments: {} });
          assert.ok(!JSON.stringify(inbox).includes(question.id));
        } finally {
          await request(1, 'admin/moderate', {
            ...write(),
            action: 'restore',
            kind: 'question',
            target_id: question.id,
            reason: 'Restore synthetic MCP visibility fixture.',
          });
          await client.close();
        }
      });
      const agentAdmin = await fetch(`${origin}/api/admin/summary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(agentAdmin.status, 401);
      await request(1, 'admin/moderate', {
        ...write(),
        action: 'warn',
        owner_id: people[2].id,
        reason: 'Synthetic warning with no actual misconduct.',
      });
      assert.ok(
        (await request(2, 'account/status')).notices.some(
          (n: { kind: string }) => n.kind === 'warn',
        ),
      );
      const notice = (await request(2, 'account/status')).notices.find(
        (n: { kind: string }) => n.kind === 'warn',
      );
      await request(3, 'account/acknowledge_notice', { notice_id: notice.id });
      assert.equal(
        (await request(2, 'account/status')).notices.find((n: { id: string }) => n.id === notice.id)
          .acknowledged,
        false,
      );
      await request(2, 'account/acknowledge_notice', { notice_id: notice.id });
      assert.equal(
        (await request(2, 'account/status')).notices.find((n: { id: string }) => n.id === notice.id)
          .acknowledged,
        true,
      );
      await request(1, 'admin/moderate', {
        ...write(),
        action: 'suspend',
        owner_id: people[2].id,
        days: 1,
        reason: 'Synthetic temporary restriction check.',
      });
      await request(2, 'relay/dashboard', {}, 403);
      assert.equal((await request(2, 'account/status')).restriction.kind, 'suspend');
      const restrictedRead = await memberClient
        .from('questions')
        .select('id')
        .eq('id', question.id);
      assert.ifError(restrictedRead.error);
      assert.deepEqual(restrictedRead.data, []);
      await sql`update private.account_restrictions set until_at=now()-interval '1 second' where owner_id=${people[2].id}`;
      assert.equal((await request(2, 'account/status')).member, true);
      await request(1, 'admin/moderate', {
        ...write(),
        action: 'ban',
        owner_id: people[2].id,
        reason: 'Synthetic permanent restriction check.',
      });
      const [revoked] = await sql`select revoked_at from private.credentials where id=${token.id}`;
      assert.ok(revoked.revoked_at);
      await request(1, 'admin/moderate', {
        ...write(),
        action: 'lift_restriction',
        owner_id: people[2].id,
        reason: 'Lift synthetic restriction after checks.',
      });
      const [stillRevoked] =
        await sql`select revoked_at from private.credentials where id=${token.id}`;
      assert.ok(stillRevoked.revoked_at);
      await t.test('A stale suspension cannot downgrade an indefinite ban', async () => {
        await request(0, 'admin/moderate', {
          ...write(),
          action: 'ban',
          owner_id: people[2].id,
          reason: 'Synthetic ban downgrade regression.',
        });
        await request(
          1,
          'admin/moderate',
          {
            ...write(),
            action: 'suspend',
            owner_id: people[2].id,
            days: 1,
            reason: 'A ban requires an explicit lift first.',
          },
          409,
        );
        const [restriction] =
          await sql`select kind from private.account_restrictions where owner_id=${people[2].id}`;
        assert.equal(restriction.kind, 'ban');
      });
      await t.test(
        'A stale restriction decision cannot apply after lift and a new ban',
        async () => {
          const [old] =
            await sql`select revision from private.account_restrictions where owner_id=${people[2].id}`;
          await request(0, 'admin/moderate', {
            ...write(),
            action: 'lift_restriction',
            owner_id: people[2].id,
            expected_revision: old.revision,
            reason: 'Lift synthetic restriction for version test.',
          });
          await request(0, 'admin/moderate', {
            ...write(),
            action: 'ban',
            owner_id: people[2].id,
            expected_revision: null,
            reason: 'New synthetic ban after previous lift.',
          });
          await request(
            1,
            'admin/moderate',
            {
              ...write(),
              action: 'lift_restriction',
              owner_id: people[2].id,
              expected_revision: old.revision,
              reason: 'Reject obsolete restriction dialog.',
            },
            409,
          );
        },
      );
      // Reset only the synthetic restriction before the independent race test.
      await sql`delete from private.account_restrictions where owner_id=${people[2].id}`;
      await t.test(
        'Token mint waits for the account lock and rechecks membership after ban',
        async () => {
          let mint: Promise<unknown> | undefined;
          let finished = false;
          const key = `agentrelay:account:${people[2].id}`;
          try {
            await sql.begin(async (gate) => {
              const [gateConnection] = await gate`select pg_backend_pid() pid`;
              await gate`select pg_advisory_xact_lock(hashtextextended(${key},0))`;
              mint = execute(
                'create_token',
                { agent_id: agent.id, scopes: ['read'] },
                { owner: people[2].id, agent: null, scopes: ['manage'] },
              ).then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
              void mint.then(() => {
                finished = true;
              });
              let blocked = false;
              const deadline = Date.now() + 8000;
              while (!finished && Date.now() < deadline) {
                const [activity] =
                  await sql`select exists(select 1 from pg_stat_activity where ${gateConnection.pid} = any(pg_blocking_pids(pid))) blocked`;
                if (activity.blocked) {
                  blocked = true;
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, 30));
              }
              assert.equal(
                blocked,
                true,
                'Token creation must join the same account lock as restriction changes.',
              );
              await gate`insert into private.account_restrictions(owner_id,kind,reason) values(${people[2].id},'ban','Synthetic concurrent token restriction')`;
              await gate`update private.credentials set revoked_at=coalesce(revoked_at,now()) where owner_id=${people[2].id}`;
            });
            const result = (await mint) as { error?: { status?: number } };
            assert.equal(result.error?.status, 403);
            const [remaining] =
              await sql`select count(*)::int total from private.credentials where owner_id=${people[2].id} and revoked_at is null`;
            assert.equal(remaining.total, 0);
          } finally {
            await mint;
          }
        },
      );
      await sql`delete from private.account_restrictions where owner_id=${people[2].id}`;
      await t.test('Approval waits for the verified Auth email being changed', async () => {
        const oldEmail = people[3].email;
        const newEmail = `relay-staff-${run}-changed@example.invalid`;
        await sql`delete from private.pilot_emails where email=${oldEmail}`;
        const [pendingAgain] =
          await sql`update private.applications set status='pending',version=version+1 where owner_id=${people[3].id} returning id,version`;
        let approval: Promise<unknown> | undefined;
        let finished = false;
        try {
          await sql.begin(async (gate) => {
            const [gateConnection] = await gate`select pg_backend_pid() pid`;
            await gate`update auth.users set email=${newEmail} where id=${people[3].id}`;
            approval = executeApplications(
              'decide_application',
              {
                ...write(),
                application_id: pendingAgain.id,
                version: pendingAgain.version,
                decision: 'approved',
                reason: 'Synthetic verified email race check.',
              },
              { owner: people[0].id, agent: null, scopes: [] },
            ).then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            void approval.then(() => {
              finished = true;
            });
            let blocked = false;
            const deadline = Date.now() + 8000;
            while (!finished && Date.now() < deadline) {
              const [activity] =
                await sql`select exists(select 1 from pg_stat_activity where ${gateConnection.pid} = any(pg_blocking_pids(pid))) blocked`;
              if (activity.blocked) {
                blocked = true;
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 30));
            }
            assert.equal(blocked, true, 'Approval must lock its joined Auth account.');
          });
          people[3].email = newEmail;
          const result = (await approval) as { error?: unknown };
          assert.equal(result.error, undefined);
          const [membership] =
            await sql`select private.member_allowed(${people[3].id}::uuid) allowed`;
          assert.equal(membership.allowed, true);
        } finally {
          await approval;
        }
      });
      await request(0, 'admin/set_moderator', {
        ...write(),
        owner_id: people[1].id,
        enabled: false,
        reason: 'Verify immediate staff role revocation.',
      });
      await request(1, 'admin/summary', {}, 403);
      const [audit] =
        await sql`select count(*)::int total from private.staff_audit where actor_id=${people[1].id}`;
      assert.ok(audit.total >= 5);
    } finally {
      const ids = people.map((p) => p.id),
        emails = people.map((p) => p.email);
      if (ids.length)
        await sql.begin(async (db) => {
          // Only generated test UUIDs from this run; never clear real service records.
          const [exists] = await db`select to_regclass('private.staff_roles') present`;
          if (exists.present) {
            await db`delete from private.content_reports where reporter_id=any(${ids}) or target_owner=any(${ids})`;
            await db`delete from private.staff_audit where actor_id=any(${ids})`;
            await db`delete from private.community_receipts where owner_id=any(${ids})`;
            await db`delete from private.rate_events where owner_id=any(${ids})`;
            await db`delete from private.account_notices where owner_id=any(${ids})`;
            await deleteFixtureApplications(db, ids);
            await db`delete from private.account_restrictions where owner_id=any(${ids})`;
            await db`delete from private.staff_roles where owner_id=any(${ids})`;
          }
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
      await sql.end();
    }
  },
);
