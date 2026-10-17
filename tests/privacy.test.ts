import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { confirmation, eraseAuth, privacyTarget } from '../scripts/privacy-core.mjs';
import { retainedResult } from '../src/lib/receipt-result';
import { privatePath } from '../scripts/secret-rules.mjs';

const ref = 'abcdefghijklmnopqrst',
  owner = '11111111-1111-4111-8111-111111111111';
const env = {
  AGENTRELAY_PRIVACY_PROJECT_REF: ref,
  DATABASE_URL: `postgresql://postgres.${ref}:synthetic@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
};
test('privacy operations refuse mismatched project, arbitrary host and invalid owner', () => {
  assert.equal(privatePath('privacy-journal.jsonl'), true);
  assert.equal(privatePath('output/privacy-journal-recovery.jsonl'), true);
  assert.equal(privacyTarget(env, owner).owner, owner);
  for (const change of [
    { AGENTRELAY_PRIVACY_PROJECT_REF: 'zyxwvutsrqponmlkjihg' },
    { DATABASE_URL: env.DATABASE_URL.replace('.pooler.supabase.com', '.example.com') },
    { DATABASE_URL: env.DATABASE_URL.replace('/postgres', '/other') },
    { NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL + '/unexpected' },
  ])
    assert.throws(() => privacyTarget({ ...env, ...change }, owner));
  assert.throws(() => privacyTarget(env, 'anything;delete'));
  assert.notEqual(confirmation(ref, 'erase', owner), confirmation(ref, 'retention'));
});
test('erased receipt replay is terminal and retains ordinary response behavior', () => {
  const response = { id: owner };
  assert.equal(retainedResult(response), response);
  assert.throws(
    () => retainedResult({ privacy_erased: true }),
    (e) => (e as { status: number }).status === 410,
  );
});
test('Auth erasure explicitly requests irreversible soft deletion; failures stop completion', async () => {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        requests.push({
          method: init!.method!,
          path: new URL(String(input)).pathname,
          body: JSON.parse(String(init!.body)),
        });
        return new Response(JSON.stringify({ id: owner }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
  await eraseAuth(client.auth, owner);
  assert.deepEqual(requests, [
    { method: 'DELETE', path: `/auth/v1/admin/users/${owner}`, body: { should_soft_delete: true } },
  ]);
  await assert.rejects(
    eraseAuth(
      { admin: { deleteUser: async () => ({ error: new Error('private diagnostic') }) } },
      owner,
    ),
    /Account remains blocked/,
  );
});
