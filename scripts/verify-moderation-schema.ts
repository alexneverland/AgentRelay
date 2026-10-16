import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { sql } from '../src/lib/db';

assert.match(process.env.AGENTRELAY_TEST_PROJECT_REF || '', /^[a-z]{20}$/);
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  `${process.env.AGENTRELAY_TEST_PROJECT_REF}.supabase.co`,
);
const rollback = new Error('intentional_fixture_rollback');
try {
  for (const suite of ['existing', 'moderation']) {
    let count = 0;
    try {
      await sql.begin(async (db) => {
        const [state] = await db`select to_regclass('private.staff_roles') present`;
        if (!state.present)
          await db.unsafe(
            readFileSync(
              'supabase/migrations/20261015170735_membership_and_moderation.sql',
              'utf8',
            ),
          );
        if (suite === 'existing') {
          const source = readFileSync('tests/rls.sql', 'utf8')
            .replace(/^begin;\s*$/im, '')
            .replace(/^rollback;\s*$/im, '');
          await db.unsafe(source);
          const [row] = await db`select count(*)::int total from assertions where passed`;
          count = row.total;
        } else {
          await db.unsafe(readFileSync('tests/moderation-rls.sql', 'utf8'));
          const [row] = await db`select count(*)::int total from mod_assertions where passed`;
          count = row.total;
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    console.log(`${suite}: ${count} SQL assertions passed; schema and fixtures rolled back.`);
  }
} finally {
  await sql.end();
}
