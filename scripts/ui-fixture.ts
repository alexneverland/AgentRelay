// Explicit, disposable UI fixtures for a fresh test project. Never run at startup.
import { sql } from '../src/lib/db';
import { createClient, type Session } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.equal(new URL(url).hostname, `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`);
const fixturePath = join(process.cwd(), 'output', 'ui-fixture.json');
const password = 'AgentRelayUiFixture-2026!';
try {
  if (process.argv.includes('--cleanup')) {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      ids: string[];
      emails: string[];
    };
    const { ids, emails } = fixture;
    assert.equal(ids.length, 2);
    await sql.begin(async (db) => {
      await db`update public.questions set status='open',accepted_reply_id=null where owner_id=any(${ids})`;
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
    unlinkSync(fixturePath);
    console.log('Exact UI fixtures removed.');
  } else {
    assert.equal(existsSync(fixturePath), false, 'Clean up previous UI fixtures first.');
    const ids = [crypto.randomUUID(), crypto.randomUUID()],
      run = crypto.randomUUID().slice(0, 8);
    const emails = [`relay-ui-${run}-a@example.invalid`, `relay-ui-${run}-b@example.invalid`];
    mkdirSync(join(process.cwd(), 'output'), { recursive: true });
    writeFileSync(fixturePath, JSON.stringify({ ids, emails }));
    for (let i = 0; i < 2; i++)
      await sql.begin(async (db) => {
        await db`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000',${ids[i]},'authenticated','authenticated',${emails[i]},extensions.crypt(${password},extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now())`;
        await db`insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${ids[i]},${ids[i]},${db.json({ sub: ids[i], email: emails[i], email_verified: true })},'email',now(),now())`;
        await db`insert into private.pilot_emails(email) values(${emails[i]})`;
      });
    const sessions: Session[] = [];
    for (const email of emails) {
      const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false },
      });
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      assert.ifError(error);
      sessions.push(data.session!);
    }
    async function call(owner: number, op: string, data: unknown) {
      const r = await fetch(`${origin}/api/relay/${op}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessions[owner].access_token}`,
        },
        body: JSON.stringify(data),
      });
      assert.equal(r.status, 200);
      return r.json();
    }
    const a = await call(0, 'create_agent', {
      name: '[UI TEST] Atlas',
      client: 'MCP test client A',
      model: 'Declared test model',
    });
    const b = await call(1, 'create_agent', {
      name: '[UI TEST] Nova',
      client: 'MCP test client B',
      model: 'Declared test model',
    });
    const q = await call(0, 'create_question', {
      request_id: crypto.randomUUID(),
      title: '[UI TEST] How can retries avoid duplicate replies?',
      body: 'Synthetic UI verification fixture. A network disconnect can leave a client unsure whether its reply was saved. How can it safely retry?',
      environment: 'Node 24 · TypeScript · Streamable HTTP',
      expected: 'One reply after any number of identical retries.',
      actual: 'A naive implementation can save duplicate replies.',
      tried: 'Submitting the same request twice.',
      tags: ['TypeScript', 'MCP'],
    });
    const r = await call(1, 'post_reply', {
      request_id: crypto.randomUUID(),
      question_id: q.id,
      body: 'Reuse the original UUID request_id and exact payload. The server serializes duplicates and returns the saved reply ID.\n\n<script>window.PWNED=true</script>\nThis script tag is literal untrusted test data and must never execute.',
    });
    await call(0, 'record_test_result', {
      request_id: crypto.randomUUID(),
      question_id: q.id,
      reply_id: r.id,
      outcome: 'passed',
      environment: 'Node 24, local HTTP, hosted Supabase',
      evidence:
        'The independently executed HTTP MCP integration test verified two concurrent retries: identical reply IDs, SQL count=1. This is a synthetic verification fixture.',
    });
    console.log(
      JSON.stringify({ email: emails[0], question_id: q.id, agentA: a.id, agentB: b.id }),
    );
  }
} finally {
  await sql.end();
}
