import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { sql } from '../src/lib/db';

const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;

test(
  'Two independent owners complete a real HTTP MCP loop with RLS boundaries',
  { timeout: 180000 },
  async (t) => {
    assert.match(
      process.env.AGENTRELAY_TEST_PROJECT_REF || '',
      /^[a-z]{20}$/,
      'Set the explicit test project ref before tests that write data.',
    );
    assert.equal(new URL(url).hostname, `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`);
    assert.ok(process.env.DATABASE_URL, 'Hosted database connection required.');
    const admin = secret
      ? createClient(url, secret, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
    const users: Array<{
      id: string;
      email: string;
      password: string;
      jwt: string;
      client: SupabaseClient;
    }> = [];
    const clients: Client[] = [];
    const run = crypto.randomUUID().slice(0, 8);
    async function web<T = Record<string, unknown>>(
      jwt: string,
      op: string,
      data: unknown = {},
      status = 200,
    ): Promise<T> {
      const r = await fetch(`${origin}/api/relay/${op}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await r.json();
      assert.equal(r.status, status, `Unexpected status for ${op}: ${JSON.stringify(body)}`);
      return body as T;
    }
    async function connect(token: string, name: string) {
      const c = new Client({ name, version: '0.1.0' });
      await c.connect(
        new StreamableHTTPClientTransport(new URL(`${origin}/api/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      clients.push(c);
      return c;
    }
    async function call<T = Record<string, unknown>>(
      client: Client,
      name: string,
      args: Record<string, unknown>,
      error = false,
    ): Promise<T> {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(Boolean(result.isError), error, JSON.stringify(result));
      const content = result.content[0];
      assert.equal(content.type, 'text');
      const parsed = JSON.parse((content as { text: string }).text);
      return (error ? parsed : parsed.data) as T;
    }
    try {
      for (let i = 0; i < 3; i++) {
        const email = `relay-test-${run}-${i}@example.invalid`,
          password = randomBytes(24).toString('base64url') + 'aA1!';
        let userId = crypto.randomUUID();
        if (admin) {
          const { data, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          assert.ifError(error);
          assert.ok(data.user);
          userId = data.user.id;
        } else {
          // Test-only fixtures for this fresh project. Normal signup always uses Auth.
          // No email is sent, and only the exact generated IDs are removed below.
          await sql.begin(async (db) => {
            await db`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
             values('00000000-0000-0000-0000-000000000000',${userId},'authenticated','authenticated',${email},extensions.crypt(${password},extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now())`;
            await db`insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${userId},${userId},${db.json({ sub: userId, email, email_verified: true })},'email',now(),now())`;
          });
        }
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        users.push({ id: userId, email, password, jwt: '', client });
        const { data: login, error: loginError } = await client.auth.signInWithPassword({
          email,
          password,
        });
        assert.ifError(loginError);
        assert.ok(login.session);
        users.at(-1)!.jwt = login.session.access_token;
        if (i < 2) await sql`insert into private.pilot_emails(email) values(${email})`;
      }
      const [a, b, outsider] = users;
      const scopes = ['read', 'publish', 'reply', 'test', 'resolve'];
      const agentA = await web<{ id: string }>(a.jwt, 'create_agent', {
        name: '[TEST] Atlas',
        client: 'MCP SDK client A',
        model: 'self-declared fixture',
      });
      const agentB = await web<{ id: string }>(b.jwt, 'create_agent', {
        name: '[TEST] Nova',
        client: 'MCP SDK client B',
        model: 'self-declared fixture',
      });
      const tokenA = await web<{ id: string; token: string }>(a.jwt, 'create_token', {
        agent_id: agentA.id,
        scopes,
      });
      const tokenB = await web<{ id: string; token: string }>(b.jwt, 'create_token', {
        agent_id: agentB.id,
        scopes,
      });
      const ca = await connect(tokenA.token, 'Owner-A'),
        cb = await connect(tokenB.token, 'Owner-B');
      const qInput = {
        request_id: crypto.randomUUID(),
        title: `[INTEGRATION TEST ${run}] Avoid duplicate posts after a retry`,
        body: 'Synthetic protocol fixture, not community activity. How can I retry an MCP request after a disconnect without a duplicate post?',
        tags: ['TypeScript', 'MCP'],
        environment: `Node ${process.version}`,
        owner_id: b.id,
        agent_id: agentB.id,
      };
      const q = await call<{ id: string }>(ca, 'create_question', qInput);
      const replyInput = {
        request_id: crypto.randomUUID(),
        question_id: q.id,
        body: 'Use the same UUID request_id and identical payload on retry. The transaction lock and receipt return the original result. <script>window.PWNED=true</script> is literal untrusted data.',
      };
      const reply = await call<{ id: string }>(cb, 'post_reply', replyInput);
      await t.test(
        'MCP discovery, search and thread preserve owner and self-declared agent identity',
        async () => {
          const listed = await ca.listTools();
          assert.ok(listed.tools.some((x) => x.name === 'record_test_result'));
          const search = await call<{ questions: Array<{ id: string }> }>(cb, 'search_questions', {
            query: run,
          });
          assert.ok(search.questions.some((x) => x.id === q.id));
          const thread = await call<{
            question: { owner_id: string; agent_id: string };
            replies: Array<{ owner_id: string }>;
            trust_notice: string;
          }>(ca, 'get_thread', { question_id: q.id });
          assert.equal(thread.question.owner_id, a.id);
          assert.equal(thread.question.agent_id, agentA.id);
          assert.equal(thread.replies[0].owner_id, b.id);
          assert.match(thread.trust_notice, /UNTRUSTED/);
        },
      );
      await t.test(
        'Concurrent retries return one immutable reply; changed payload conflicts',
        async () => {
          const retries = await Promise.all([
            call<{ id: string }>(cb, 'post_reply', replyInput),
            call<{ id: string }>(cb, 'post_reply', replyInput),
          ]);
          for (const r of retries) assert.equal(r.id, reply.id);
          const [count] =
            await sql`select count(*)::int total from public.replies where question_id=${q.id}`;
          assert.equal(count.total, 1);
          await call(cb, 'post_reply', { ...replyInput, body: 'Different content' }, true);
        },
      );
      await t.test(
        'Only the question owner can resolve, and only after a passing test',
        async () => {
          await call(cb, 'mark_solved', { question_id: q.id, reply_id: reply.id }, true);
          await call(ca, 'mark_solved', { question_id: q.id, reply_id: reply.id }, true);
          await call(ca, 'record_test_result', {
            request_id: crypto.randomUUID(),
            question_id: q.id,
            reply_id: reply.id,
            outcome: 'failed',
            environment: `Node ${process.version}, Windows, local HTTP -> hosted Supabase`,
            evidence:
              'Synthetic failed control: no passing test exists yet. This is a test fixture, not a user claim.',
          });
          await call(ca, 'mark_solved', { question_id: q.id, reply_id: reply.id }, true);
          await call(ca, 'record_test_result', {
            request_id: crypto.randomUUID(),
            question_id: q.id,
            reply_id: reply.id,
            outcome: 'passed',
            environment: `Node ${process.version}, Windows, two MCP SDK clients`,
            evidence:
              'Actually performed: two concurrent retries with identical request_id and payload returned the same reply ID. SQL count=1. Different payload was rejected. This verifies transport/idempotency, not Codex/Claude app compatibility.',
          });
          const result = await call<{ status: string }>(ca, 'mark_solved', {
            question_id: q.id,
            reply_id: reply.id,
          });
          assert.equal(result.status, 'solved');
        },
      );
      await t.test(
        'Notifications persist across reconnect and acknowledgement is owner-scoped',
        async () => {
          const inbox = await call<{ notifications: Array<{ id: number; question_id: string }> }>(
            ca,
            'get_inbox',
            {},
          );
          const mine = inbox.notifications.find((x) => x.question_id === q.id);
          assert.ok(mine);
          const denied = await call<{ acknowledged: number[] }>(cb, 'acknowledge_notifications', {
            ids: [Number(mine.id)],
          });
          assert.deepEqual(denied.acknowledged, []);
          const reconnect = await connect(tokenA.token, 'Owner-A-reconnected');
          const again = await call<{ notifications: Array<{ id: number }> }>(
            reconnect,
            'get_inbox',
            {},
          );
          assert.ok(again.notifications.some((x) => x.id === mine.id));
          await call(reconnect, 'acknowledge_notifications', { ids: [Number(mine.id)] });
          const after = await call<{ notifications: Array<{ id: number }> }>(ca, 'get_inbox', {});
          assert.ok(!after.notifications.some((x) => x.id === mine.id));
        },
      );
      await t.test('Anonymous and uninvited accounts cannot read closed pilot data', async () => {
        assert.equal((await fetch(`${origin}/api/mcp`, { method: 'POST' })).status, 401);
        await web(outsider.jwt, 'search_questions', {}, 403);
        const anon = createClient(url, key, { auth: { persistSession: false } });
        assert.ok((await anon.from('questions').select('id')).error);
        const outside = await outsider.client.from('questions').select('id');
        assert.ifError(outside.error);
        assert.deepEqual(outside.data, []);
      });
      await t.test(
        'Raw Data API cannot spoof owners, reassign agents, edit replies, or resolve others',
        async () => {
          const forged = await b.client.from('replies').insert({
            question_id: q.id,
            owner_id: a.id,
            request_id: crypto.randomUUID(),
            body: 'forged',
          });
          assert.ok(forged.error);
          const foreignAgent = await b.client.from('replies').insert({
            question_id: q.id,
            owner_id: b.id,
            agent_id: agentA.id,
            request_id: crypto.randomUUID(),
            body: 'forged agent',
          });
          assert.ok(foreignAgent.error);
          const edit = await b.client
            .from('replies')
            .update({ body: 'Changed after successful test' })
            .eq('id', reply.id);
          assert.ok(edit.error);
          const resolve = await b.client
            .from('questions')
            .update({ status: 'solved', accepted_reply_id: reply.id })
            .eq('id', q.id)
            .select();
          assert.ifError(resolve.error);
          assert.deepEqual(resolve.data, []);
          const privateTokens = await b.client.schema('private').from('credentials').select('*');
          assert.ok(privateTokens.error);
          await web(b.jwt, 'create_token', { agent_id: agentA.id, scopes: ['read'] }, 403);
        },
      );
      await t.test(
        'Read scopes, revocation, expiration and agent binding hold on every request',
        async () => {
          const readToken = await web<{ id: string; token: string }>(b.jwt, 'create_token', {
            agent_id: agentB.id,
            scopes: ['read'],
          });
          const reader = await connect(readToken.token, 'Read-only');
          assert.ok(!(await reader.listTools()).tools.some((x) => x.name === 'post_reply'));
          await web(readToken.token, 'post_reply', replyInput, 403);
          await web(b.jwt, 'revoke_token', { token_id: readToken.id });
          await assert.rejects(reader.listTools());
          const exp = await web<{ id: string; token: string }>(b.jwt, 'create_token', {
            agent_id: agentB.id,
            scopes: ['read'],
          });
          await sql`update private.credentials set expires_at=now()-interval '1 second' where id=${exp.id}`;
          await assert.rejects(connect(exp.token, 'Expired'));
        },
      );
      await t.test(
        'Thread mismatches, secret-like text and cross-origin requests are rejected',
        async () => {
          const another = await call<{ id: string }>(ca, 'create_question', {
            ...qInput,
            request_id: crypto.randomUUID(),
            title: '[INTEGRATION TEST] Second question for FK boundary',
          });
          await call(
            ca,
            'record_test_result',
            {
              request_id: crypto.randomUUID(),
              question_id: another.id,
              reply_id: reply.id,
              outcome: 'passed',
              environment: 'Node test',
              evidence: 'Must fail: reply belongs to another thread',
            },
            true,
          );
          await call(
            cb,
            'post_reply',
            {
              ...replyInput,
              request_id: crypto.randomUUID(),
              body: 'ghp_' + '1'.repeat(30),
            },
            true,
          );
          const r = await fetch(`${origin}/api/mcp`, {
            method: 'POST',
            headers: {
              Origin: 'https://attacker.example',
              Authorization: `Bearer ${tokenA.token}`,
            },
          });
          assert.equal(r.status, 403);
        },
      );
    } finally {
      for (const c of clients) await c.close().catch(() => {});
      const ids = users.map((u) => u.id),
        emails = users.map((u) => u.email);
      // Only the exact IDs created in this run are disposable fixtures.
      if (ids.length)
        await sql.begin(async (db) => {
          await db`update public.questions set status='open',accepted_reply_id=null where owner_id=any(${ids})`;
          await db`delete from public.notifications where owner_id=any(${ids}) or question_id in (select id from public.questions where owner_id=any(${ids}))`;
          await db`delete from public.test_results where owner_id=any(${ids})`;
          await db`delete from public.replies where owner_id=any(${ids})`;
          await db`delete from public.questions where owner_id=any(${ids})`;
          await db`delete from public.write_receipts where owner_id=any(${ids})`;
          await db`delete from private.credentials where owner_id=any(${ids})`;
          await db`delete from public.agents where owner_id=any(${ids})`;
          await db`delete from public.profiles where id=any(${ids})`;
          await db`delete from private.pilot_emails where email=any(${emails})`;
        });
      for (const u of users) {
        await u.client.auth.signOut();
        if (admin) {
          const { error } = await admin.auth.admin.deleteUser(u.id);
          assert.ifError(error);
        } else await sql`delete from auth.users where id=${u.id}`;
      }
      await sql.end();
    }
  },
);
