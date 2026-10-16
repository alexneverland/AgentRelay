// Pre-migration hosted check: all fixtures and DDL are rolled back; no email APIs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sql } from '../src/lib/db';

assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
);
const rollback = new Error('intentional_rollout_rollback');
const legacy = randomUUID(),
  attacker = randomUUID(),
  target = randomUUID();
let count = 0;
try {
  try {
    await sql.begin(async (db) => {
      await db`set local lock_timeout='5s'`;
      await db`set local statement_timeout='20s'`;
      const legacyMode = !process.argv.includes('--forgery-only');
      if (legacyMode) {
        await db`insert into auth.users(id,email,email_confirmed_at) values(${legacy},${legacy + '@example.invalid'},now())`;
        await db`insert into public.profiles(id,display_name) values(${legacy},'Synthetic legacy owner')`;
        await db`insert into public.write_receipts(owner_id,request_id,fingerprint,result) values(${legacy},${randomUUID()},${'x'.repeat(129)},${db.json('x'.repeat(262145))})`;
        await db`insert into public.agents(owner_id,name,client,interests) values(${legacy},'Synthetic legacy agent','SQL',array_fill('legacy'::text,array[11]))`;
        await db`insert into private.applications(owner_id,display_name,use_case,client,interests) values(${legacy},'Synthetic legacy applicant','Rollback-only legacy rollout test','SQL',array_fill('legacy'::text,array[11]))`;
      }
      await db.unsafe(
        readFileSync('supabase/migrations/20261016182448_bound_member_storage.sql', 'utf8'),
      );
      if (legacyMode) {
        const [old] =
          await db`select length(fingerprint) fingerprint,octet_length(result::text) bytes from public.write_receipts where owner_id=${legacy}`;
        assert.equal(old.fingerprint, 129);
        assert.ok(old.bytes > 262144);
        count++;
        const [agent] =
          await db`select cardinality(interests) n from public.agents where owner_id=${legacy}`;
        assert.equal(agent.n, 11);
        count++;
        const [application] =
          await db`select cardinality(interests) n from private.applications where owner_id=${legacy}`;
        assert.equal(application.n, 11);
        count++;
        await assert.rejects(
          db.savepoint(async (tx) => {
            await tx`alter table public.write_receipts validate constraint receipt_result_size`;
          }),
          (error: unknown) => (error as { code: string }).code === '23514',
        );
        count++;
      }
      let unlock!: () => void, locked!: () => void;
      const release = new Promise<void>((r) => {
        unlock = r;
      });
      const ready = new Promise<void>((r) => {
        locked = r;
      });
      const holder = sql
        .begin(async (tx) => {
          await tx`select pg_advisory_xact_lock(hashtextextended(${'agentrelay:account:' + target},0))`;
          locked();
          await release;
          throw rollback;
        })
        .catch((error: unknown) => {
          if (error !== rollback) throw error;
        });
      try {
        await ready;
        for (const kind of ['receipt', 'question', 'reply', 'test', 'agent']) {
          await assert.rejects(
            db.savepoint(async (tx) => {
              await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: attacker, role: 'authenticated' })},true)`;
              await tx`set local role authenticated`;
              await tx`set local lock_timeout='200ms'`;
              if (kind === 'receipt')
                await tx`insert into public.write_receipts(owner_id,request_id,fingerprint,result) values(${target},${randomUUID()},'synthetic','{}')`;
              else if (kind === 'question')
                await tx`insert into public.questions(owner_id,request_id,title,body) values(${target},${randomUUID()},'Forged synthetic question','Synthetic')`;
              else if (kind === 'reply')
                await tx`insert into public.replies(owner_id,request_id,question_id,body) values(${target},${randomUUID()},${randomUUID()},'Synthetic')`;
              else if (kind === 'test')
                await tx`insert into public.test_results(owner_id,request_id,question_id,reply_id,outcome,environment,evidence) values(${target},${randomUUID()},${randomUUID()},${randomUUID()},'failed','SQL','Synthetic')`;
              else
                await tx`insert into public.agents(owner_id,name,client) values(${target},'Forged synthetic agent','SQL')`;
            }),
            (error: unknown) => (error as { code: string }).code === '42501',
          );
          count++;
        }
      } finally {
        unlock();
        await holder;
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(`${count} rollout assertions passed; schema and fixtures rolled back.`);
} finally {
  await sql.end();
}
