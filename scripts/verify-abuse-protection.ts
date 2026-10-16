// Operator-authorized, rollback-only checks; no Auth API calls or email sends.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from '../src/lib/db';
assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
);
const rollback = new Error('intentional_fixture_rollback');
try {
  for (const suite of ['abuse', 'existing', 'moderation']) {
    try {
      await sql.begin(async (db) => {
        if (process.env.AGENTRELAY_VALIDATE_MIGRATION === '1')
          await db.unsafe(
            readFileSync('supabase/migrations/20261016110609_abuse_budgets.sql', 'utf8'),
          );
        const path =
          suite === 'abuse'
            ? 'tests/abuse-protection.sql'
            : suite === 'existing'
              ? 'tests/rls.sql'
              : 'tests/moderation-rls.sql';
        await db.unsafe(
          readFileSync(path, 'utf8')
            .replace(/^begin;\s*$/im, '')
            .replace(/^rollback;\s*$/im, ''),
        );
        await db`reset role`;
        const table =
          suite === 'abuse'
            ? 'abuse_assertions'
            : suite === 'existing'
              ? 'assertions'
              : 'mod_assertions';
        const [row] = await db.unsafe(`select count(*)::int total from ${table}`);
        console.log({
          suite,
          assertions: row.total,
          passed: true,
          fixtures: 'transaction will roll back',
          emailsSent: 0,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
} finally {
  await sql.end();
}
