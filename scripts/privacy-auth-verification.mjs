// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
// Import from an explicitly authorized operator test harness. Never log the returned
// session context: it contains synthetic credentials/tokens held only for this run.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { eraseAuth } from './privacy-core.mjs';

// Run the returned SQL only through an authorized connector for context.ref.
// Committed synthetic rows are necessary for the subsequent real Auth API call.
export function authErasureVerificationSQL(context) {
  const [a, b] = context.created.map((user) => user.id);
  for (const id of [a, b]) assert.match(id, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  let fixture = readFileSync('tests/privacy-fixture.sql', 'utf8');
  assert.ok(fixture.includes('gen_random_uuid() a,gen_random_uuid() b'));
  assert.match(fixture, /insert into auth\.users[\s\S]*?from privacy_test_ids;/);
  assert.match(fixture, /insert into private\.pilot_emails[\s\S]*?from privacy_test_ids;/);
  fixture = fixture
    .replace('gen_random_uuid() a,gen_random_uuid() b', `'${a}'::uuid a,'${b}'::uuid b`)
    .replace(/insert into auth\.users[\s\S]*?from privacy_test_ids;/, '')
    .replace(
      /insert into private\.pilot_emails[\s\S]*?from privacy_test_ids;/,
      `insert into private.pilot_emails select lower(email) from auth.users where id in ('${a}','${b}');`,
    );
  return `begin; set local statement_timeout='60s';\n${fixture}\n${readFileSync('scripts/privacy-erase.sql', 'utf8')}\n${readFileSync('tests/privacy-erasure-assertions.sql', 'utf8')}\ncommit;`;
}

export async function createAuthErasureFixtures(ref, key) {
  assert.match(ref, /^[a-z]{20}$/);
  const url = `https://${ref}.supabase.co`;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, key, options);
  const created = [];
  try {
    for (let i = 0; i < 2; i++) {
      const email = `${randomUUID()}@example.invalid`;
      const password = randomUUID() + randomUUID();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { privacy_fixture: true },
      });
      assert.equal(error, null, 'Synthetic Auth creation must succeed without email delivery.');
      created.push({ id: data.user.id, email, password });
    }
    const session = createClient(url, key, options);
    const { data, error } = await session.auth.signInWithPassword(created[0]);
    assert.equal(error, null, 'Synthetic password login must work before erasure.');
    assert.ok(data.session?.refresh_token);
    return { ref, admin, session, created, refreshToken: data.session.refresh_token };
  } catch (error) {
    for (const user of created) await admin.auth.admin.deleteUser(user.id);
    throw error;
  }
}

export async function verifyAuthErasure(context) {
  const { admin, session, created, refreshToken } = context;
  await eraseAuth(admin.auth, created[0].id);
  await eraseAuth(admin.auth, created[0].id); // Resume after a lost response is safe.
  const { data, error } = await admin.auth.admin.getUserById(created[0].id);
  assert.equal(error, null);
  assert.ok(data.user.deleted_at, 'A linked technical Auth tombstone must remain.');
  assert.notEqual(data.user.email, created[0].email);
  assert.equal(Object.keys(data.user.user_metadata).length, 0);
  const refreshed = await session.auth.refreshSession({ refresh_token: refreshToken });
  assert.ok(refreshed.error, 'Old refresh credentials must not restore a session.');
  const login = await session.auth.signInWithPassword(created[0]);
  assert.ok(login.error, 'The original credentials must no longer sign in.');
  const other = await admin.auth.admin.getUserById(created[1].id);
  assert.equal(other.error, null);
  assert.equal(other.data.user.email, created[1].email);
  assert.ok(!other.data.user.deleted_at);
  return {
    softDelete: true,
    retry: true,
    credentialsRejected: true,
    refreshRejected: true,
    otherOwnerUnchanged: true,
  };
}

// Call only after exact application fixture cleanup; never derive targets by email search.
export async function cleanupAuthErasureFixtures(context) {
  for (const user of context.created) {
    const result = await context.admin.auth.admin.deleteUser(user.id);
    assert.equal(result.error, null, 'Exact synthetic Auth fixture cleanup must succeed.');
  }
}
