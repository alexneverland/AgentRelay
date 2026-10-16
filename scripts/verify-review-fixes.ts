// Explicit operator authorization is required. All DDL/data are rolled back; no email APIs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from '../src/lib/db';
import { readThread } from '../src/lib/service';
import { deleteFixtureApplications } from './fixture-cleanup';

assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
);
const rollback = new Error('intentional_review_rollback');
let count = 0;
try {
  try {
    await sql.begin(async (db) => {
      await db`set local lock_timeout='5s'`;
      await db`set local statement_timeout='20s'`;
      if (process.env.AGENTRELAY_VALIDATE_MIGRATION === '1')
        await db.unsafe(
          readFileSync('supabase/migrations/20261016182448_bound_member_storage.sql', 'utf8'),
        );
      await db.unsafe(readFileSync('tests/review-storage.sql', 'utf8'));
      const [ids] = await db`select * from review_ids`;
      await db`select set_config('request.jwt.claims',${JSON.stringify({ sub: ids.a, role: 'authenticated' })},true)`;
      await db`set local role authenticated`;
      const page = await readThread(db, ids.a, ids.question);
      assert.equal(page.tests.length, 20);
      assert.equal(
        page.tests.some((x) => x.outcome === 'passed'),
        false,
      );
      assert.equal(
        page.replies[0].can_resolve,
        true,
        'Passing test on page 2 must allow resolution on page 1',
      );
      const second = await readThread(db, ids.a, ids.question, 20);
      assert.equal(second.tests[0].outcome, 'passed');
      count += 2;
      await db`reset role`;
      await db`update public.test_results set moderation_hidden=true where owner_id=${ids.a} and outcome='passed'`;
      await db`set local role authenticated`;
      const hidden = await readThread(db, ids.a, ids.question);
      assert.equal(
        hidden.replies[0].can_resolve,
        false,
        'Hidden passing evidence must not permit resolution',
      );
      count++;
      await db`reset role`;
      await deleteFixtureApplications(db, [ids.a]);
      const [remaining] =
        await db`select count(*)::int n from private.applications where owner_id=${ids.a}`;
      assert.equal(remaining.n, 0);
      count++;
      const [checks] = await db`select count(*)::int n from review_assertions where passed`;
      count += checks.n;
      for (const [file, table] of [
        ['tests/abuse-protection.sql', 'abuse_assertions'],
        ['tests/rls.sql', 'assertions'],
        ['tests/moderation-rls.sql', 'mod_assertions'],
      ]) {
        const source = readFileSync(file!, 'utf8')
          .replace(/^begin;\s*$/im, '')
          .replace(/^rollback;\s*$/im, '');
        await db.unsafe(source);
        const [checks] = await db.unsafe<{ n: number }[]>(
          `select count(*)::int n from ${table} where passed`,
        );
        count += checks!.n;
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(`${count} review regression assertions passed; schema and fixtures rolled back.`);
} finally {
  await sql.end();
}
