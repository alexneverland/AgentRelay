import assert from 'node:assert/strict';
import { z } from 'zod';
import { sql } from '../src/lib/db';
import { audit } from '../src/lib/staff-transactions';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  assert.ok(index >= 0 && process.argv[index + 1], `Supply ${name} explicitly.`);
  return process.argv[index + 1];
}
try {
  const project = argument('--project');
  assert.match(project, /^[a-z]{20}$/);
  assert.equal(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    `${project}.supabase.co`,
    'Configured project does not match the explicit target.',
  );
  const owner = z.uuid().parse(argument('--owner'));
  await sql.begin(async (db) => {
    await db`select pg_advisory_xact_lock(hashtextextended('agentrelay:staff-authority',0))`;
    const [account] =
      await db`select id,private.member_allowed(id) allowed from auth.users where id=${owner}`;
    assert.ok(
      account?.allowed,
      'Master must be an existing verified, approved, unrestricted account.',
    );
    const [current] = await db`select owner_id from private.staff_roles where role='master'`;
    assert.ok(
      !current || current.owner_id === owner,
      'A different master already exists; automatic transfer is forbidden.',
    );
    if (!current) {
      await db`insert into private.staff_roles(owner_id,role) values(${owner},'master') on conflict(owner_id) do update set role='master'`;
      await audit(
        db,
        { owner, role: 'operator' },
        'bootstrap_master',
        owner,
        'Operator explicitly bootstrapped the verified installation owner.',
        null,
        { role: 'master' },
      );
    }
  });
  console.log('Verified owner has the Master role. No account password changed.');
} finally {
  await sql.end();
}
