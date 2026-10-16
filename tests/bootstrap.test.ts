import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Master bootstrap rejects implicit projects, mismatched targets and invalid owner UUIDs before connecting', () => {
  const project = 'a'.repeat(20);
  const cases = [
    { args: [], error: /Supply --project explicitly/ },
    {
      args: ['--project', 'b'.repeat(20), '--owner', crypto.randomUUID()],
      error: /Configured project does not match/,
    },
    { args: ['--project', project, '--owner', 'not-a-user-id'], error: /Invalid UUID/ },
  ];
  for (const entry of cases) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/bootstrap-master.ts', ...entry.args],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          DATABASE_URL: '',
          NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
        },
      },
    );
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, entry.error);
  }
});
